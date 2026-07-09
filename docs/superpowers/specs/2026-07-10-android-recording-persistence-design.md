# Android 녹음 디스크 보존 + 복구 업로드 설계 (#187)

2026-07-10 · 관련: FE#186(업로드 트리거 ended 즉시화, 머지됨), FE#187, BE#179(callId race)

## 배경 / 문제

Android(web 경로) 녹음은 MediaRecorder chunks가 **메모리에만** 존재한다. 업로드가 끝나기 전에
앱이 종료되면(강제 종료, 백그라운드 킬) 녹음이 영구 유실된다. prod에서 통화 16·17의 Android
녹음이 실제로 유실됐다. 녹음은 상대방 분석(transcript 병합)에도 쓰이는 **상대방의 자산**이므로
유실 불허가 정책이다 — v1의 "Android 복구 없음" 결정을 폐기한다.

iOS는 이미 동등 패턴을 갖고 있다: 네이티브가 `.m4a`를 앱 샌드박스에 저장 → 업로드 성공 시 삭제
→ 실패/미발사 시 다음 앱 시작 때 `recoveryRun`이 재업로드.

## 결정 사항 (사용자 합의)

1. **업로드 소스 = 메모리 + 폰 디스크 백업.** 통화 중 chunks를 메모리에 쌓으면서 동시에
   앱 전용 저장소(Directory.Data)에 이어 쓴다. 종료 시엔 메모리 blob으로 즉시 업로드(기존 경로),
   디스크 파일은 실패/강제종료 대비 백업으로만 쓴다. 업로드 성공 시 파일 즉시 삭제.
2. **만료 정리 = BE 에러코드 기반.** 복구 업로드에서 400(만료)/401/403 응답이면 파일 삭제.
   로컬 날짜(mtime) 로직은 두지 않는다. 네트워크 실패/5xx는 보존 → 다음 시작 재시도.
3. 평상시 디스크 파일 수는 0개. 남는 것은 "아직 못 올린 녹음"뿐이며 통화당 최대 ~7MB(20분 상한).

## 구성 요소

### 1) `androidRecordingStore.ts` (신규)

`@capacitor/filesystem`(신규 설치) 래핑. 경로: `recordings/call-<callId>.<ext>`
(ext는 base mimeType에서: `audio/webm`→`webm`, `audio/mp4`→`mp4`. 복구 시 확장자로 mimeType 복원).

- `createAndroidRecordingStore(callId, mimeType)` → `{ append(chunk), remove() }`
  - open 시 동일 callId 잔존 파일을 truncate(재통화 대비)
  - `append`: Blob→base64→`Filesystem.appendFile`. appendFile은 호출마다 base64를 디코드해
    바이트를 이어 붙이므로 chunk 단위 append가 안전하다. **append는 promise chain으로 직렬화**
    (동시 호출 시 순서 보장). append 실패는 warn만 — 녹음 본선(메모리 경로)에 영향 없음.
- `listPendingAndroidRecordings()` → `[{ callId, path, mimeType, sizeBytes }]` (파일명 파싱)
- `readPendingRecording(path)` → Blob (base64→bytes, type=확장자 기반)
- `deletePendingRecording(path)`

### 2) `callRecorder.ts` Android 경로 수정

- `start(callId)`: store 생성. `ondataavailable`에서 메모리 chunks 축적 + `store.append` 병행
- `finalize(callId)`: 기존대로 메모리 blob 업로드 → **성공 시 `store.remove()`**, 실패 시 파일 보존
  (다음 시작 recovery가 처리). chunks가 비어 blob을 못 만들면 잔존 파일만 정리

### 3) `recordingRecovery.ts` 확장

iOS 전용 early-return을 플랫폼 분기로 확장. Android 분기:
`listPendingAndroidRecordings` → 각 파일 read→Blob → `uploadRecordingBlob({callId, blob})` →
성공 시 삭제 / `ApiError` 400·401·403 시 삭제 / 그 외(네트워크·5xx) 보존.
size 0 파일은 업로드 없이 삭제(iOS와 동일).

iOS와 흐름은 분리 유지(파일 소스·업로더가 달라 억지 추상화 금지 — coupling 규칙),
에러 판정(`삭제 대상 status 인가`) 헬퍼만 공유한다.

주의: iOS의 400 `CALL_RECORDING_S3_MISSING`(재시도 가능)과 달리 Android는 400을 만료로 간주해
삭제한다. 만료 400과 S3_MISSING 400을 구분해야 할 필요가 생기면 BE 에러코드 문자열 매칭으로 후속.

### 4) 네이티브 반영

`@capacitor/filesystem` npm 설치 + Android `npx cap sync android`(빌드 시점).
iOS sync는 `npm run sync:ios` 사용(직접 cap sync ios 금지 — SPM wipe).

## 테스트 (vitest, Filesystem·MediaRecorder mock)

- store: 경로/확장자 규칙, append 직렬화·base64 변환, truncate, list 파싱, read/delete
- recorder: append 병행, 업로드 성공 시 remove, 실패 시 보존, 빈 chunks 시 정리
- recovery: Android 분기 — 성공 삭제 / 400·401·403 삭제 / 네트워크 보존 / size 0 삭제 / iOS 경로 회귀 없음

## 범위 밖

- BE callId race(BE#179) — race에 걸린 통화는 callId가 없어 녹음 자체가 시작 안 됨
- iOS 동작 변경 없음
