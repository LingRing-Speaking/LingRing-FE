# 통화 녹음 설계 (Call Recording Design)

- 작성일: 2026-05-19
- 상태: 승인 대기
- 이슈: [#116 feat: 녹음 기능 추가](https://github.com/LingRing-Speaking/LingRing-FE/issues/116) — Phase 2 용. Phase 1 용 이슈는 spec 승인 후 별도 생성
- 선행 작업:
  - `2026-04-29-voice-p2p-connection-design.md` (P2P 통화 + native libwebrtc)
  - `IOS_AUDIO_ROUTING_INVESTIGATION.md` (#84 1차 조사)
  - `IOS_AUDIO_ROUTING_REVISITED.md` (#84 2차 재조사 + 방안 3 commit)
- 대응 백엔드 명세: Phase 2 진행 전 BE 팀과 협의 — `POST /calls/<roomId>/recordings:presign`, `:complete`

## TL;DR

통화 종료 후 각 클라이언트가 자기 마이크 입력만 분리된 m4a 파일로 S3에 업로드 (AI 피드백 분석용). dev/Android는 W3C `MediaRecorder`로 단순 구현. **iOS만 구조적으로 막혀** 우회 경로 필요.

iOS의 진짜 살아있는 길은 **Custom `RTCAudioDevice` (ADM) 주입** 하나. 나머지 경로(`AVAudioRecorder` 별도·`AVAudioEngine` 별도 tap·`RTCAudioTrack` sink 부착·`AecDump`·`ReplayKit`)는 iOS architectural limit 또는 API 부재로 막힘. ADM은 libwebrtc의 audio engine 라이프사이클(마이크 캡처 + 스피커 출력 + audio session)을 우리가 직접 구현 — 약 500~800 LOC Swift.

작업이 작지 않고 prior art가 부족한 niche 영역이라, **2단계 PR + Spike 게이트**로 점진적 진행. Spike 1주 안 검증 실패하면 SaaS/SFU 전환을 진지하게 재검토 (이 spec에 대안 명시).

## 1. 요구사항

```
ClientA 디바이스:  자기 마이크 PCM → m4a 파일 → S3 업로드
ClientB 디바이스:  자기 마이크 PCM → m4a 파일 → S3 업로드
```

각 클라이언트 안에서:
1. **마이크 입력 PCM 얻기** (← iOS에서만 구조적 난점)
2. PCM → m4a 인코딩 (AAC 64kbps mono)
3. 통화 종료 후 S3 업로드 (presigned PUT URL)
4. 업로드 실패 시 재시도 (다음 앱 실행 시 잔여 파일 recovery)

### 결정 사항 (브레인스토밍 합의)

| 항목 | 결정 | 근거 |
|---|---|---|
| 목적 | AI 피드백 리포트 (서버 처리용) | 사용자 직접 재생 X, 분석 후 폐기 가능 |
| 녹음 대상 | 각자 자기 마이크 입력만 (uplink) | 화자 분리 자연 · 데이터량 최소 · iOS native ADM도 단순 |
| 업로드 시점 | 통화 종료 후 일괄 + startup recovery | 통화 중 chunk 스트리밍은 YAGNI. multipart 부담 회피 |
| BE API | Presigned PUT URL | AWS 권장 패턴, BE 메모리/대역 부담 없음 |
| 보존 정책 | S3 lifecycle 7일 (배포 전 재검토) | TBD — 출시 시점에 법무·BE 협의 후 확정 |
| 이번 PR 범위 | iOS 우선 | 사용자 결정. Web/Android는 후속 |
| 클라 아키텍처 | `useCallRecording` 별도 hook | 통화·녹음 책임 분리. `useCallSession` 변경 없음 |

## 2. iOS에서 막힌 경로 (전수 조사 결과)

각 경로의 막힘 이유를 명시. 향후 누가 spec을 봐도 "왜 ADM이어야 하는가"가 재현되도록.

| # | 경로 | 결과 | 근거 |
|---|---|---|---|
| 1 | 별도 `AVAudioRecorder` 인스턴스 | ❌ 불가 | iOS는 동일 input route를 두 audio entity가 동시 캡처 불가 |
| 2 | 별도 `AVAudioEngine.inputNode` tap | ❌ 사실상 불가 | Apple Forums 821942 — VoiceProcessingIO + RemoteIO 공존 불가. libwebrtc가 이미 VPIO 점유. Medium에 PoC 동작 보고가 있으나 production-grade 안정성 미검증. 문서 기반 95% 실패 예측 |
| 3 | `RTCAudioTrack` 에 sink/renderer 부착 | ❌ API 부재 | stasel/WebRTC 147 public 헤더에 `RTCAudioRenderer.h` 없음. `RTCAudioTrack`에 add renderer 메서드 없음 (`source` getter만) |
| 4 | WebRTC `AecDump` (디버그 녹음) | ❌ 부적합 | protobuf 디버그 형식 + 헤더 코멘트 "API call will likely change in the future" |
| 5 | `ReplayKit` Broadcast Extension | ❌ 부적합 | 화면 녹화 UX prompt 노출 + App Store 정책상 통화 녹음 부적절 |
| 6 | WKWebView 회귀 + `MediaRecorder` | ❌ 막힘 | #84 audio routing 안정성 잃음. 방안 1·2 실패 history 재현 |
| 7 | WebRTC SDK 교체 (LiveKit·Sora 등) | ⚠️ 본질 같음 + 추가 비용 | 결국 다른 SDK의 ADM 사용 = #8과 본질 같음 + SDK 교체 비용. LiveKit은 사용자 부정 경험 |
| 8 | **Custom `RTCAudioDevice` (ADM) 주입** | ✅ **공식 가능** | stasel/WebRTC 147 `RTCAudioDevice.h` 노출 + `RTCPeerConnectionFactory init`에 `audioDevice:` overload 노출 + 헤더 코멘트가 mstyura 참조 구현 endorse |

## 3. 채택 경로 — Custom RTCAudioDevice (ADM)

### 핵심 개념

ADM (Audio Device Module) = libwebrtc가 마이크·스피커와 통신하는 오디오 드라이버 어댑터.

```
[기본 ADM — libwebrtc 내장, 우리가 못 봄]
  마이크 → 기본 ADM → libwebrtc → SRTP → 네트워크
  스피커 ← 기본 ADM ← libwebrtc ← SRTP ← 네트워크

[Custom ADM — 우리가 작성]
  마이크 → 우리 ADM ─┬─→ libwebrtc → SRTP → 네트워크
                    │
                    └─→ AVAudioFile.write → S3   ← 우리가 추가하는 부분
  스피커 ← 우리 ADM ← libwebrtc ← SRTP ← 네트워크
```

핵심: 마이크 PCM이 libwebrtc로 들어가는 같은 지점에서 분기해 파일로도 write. AVAudioSinkNode block 안에서 두 작업을 동시에.

### Prior art 와 그 한계

조사 결과 production reference로 그대로 가져올 수 있는 코드는 없음. 모두 자체 fork된 WebRTC SDK 위에서 동작.

| Reference | 평가 |
|---|---|
| mstyura/RTCAudioDevice (헤더 endorse) | ⭐ 4년 stale, ⭐39, "예제" 명시. 패턴 학습용만 |
| LiveKit (`LKRTCxxx` prefix) | 자체 fork. 사용자 부정 경험 |
| Sora (`shiguredo-webrtc-ios` M132) | 자체 fork. 우리 M147과 API 차이 (`RTCAudioDeviceModule` 노출 차이) |
| Stream Video / Riverside / Bandwidth / Signal RingRTC | 모두 자체 fork. copy 불가 |
| Jitsi Meet PR #15534 | API hook만 노출, ADM 자체 구현 X (헤더 코멘트가 mstyura URL 가리킴) |

**결론**: `RTCAudioDevice` protocol 자체는 stasel/WebRTC 147에 노출됨. 즉 우리가 protocol을 implement한 ADM을 직접 작성하는 것은 가능. 다만 다른 SDK의 코드를 그대로 가져올 수는 없음 — 패턴 학습 후 우리 환경에 맞게 직접 작성.

### Niche 영역임을 인지

이 길은 메이저 회사들이 가지 않는 길:
- 메이저 회의 앱은 SFU + 서버 녹음 (Teams/Meet/Zoom)
- 1:1 P2P 통화 + 클라 자체 녹음 use case 자체가 흔치 않음
- ADM 구현은 보통 SDK 회사 내부 영역 (LiveKit·Sora 등이 내부에서 처리)
- `stasel/WebRTC + 자체 ADM` 조합은 극소수

따라서:
- Stack Overflow / Apple Forums에 우리 use case 매칭하는 답 없음
- 구현 중 막히면 self-resolve해야 함
- #84와 비슷한 험난한 여정 가능성

이 사실을 명시하고, **Spike 단계 게이트로 무리한 진행을 방지**.

## 4. 진행 방식 — 3단계

```
Step 1.  Spike (1주 max, 별도 브랜치 `spike/call-adm-replacement`, 머지 X)
         │
         ▼
  ┌──── 검증 결과 ────┐
  │                  │
  6/6 통과         ≤2/6 통과
  │                  │
  ▼                  ▼
Step 2.            STOP.
Phase 1            사용자 + BE 팀과
ADM 교체 PR        SaaS/SFU 전환 재검토
(1~2주)
  │
  ▼
Step 3.
Phase 2
녹음 + S3 PR (1주)
  │
  ▼
[iOS 녹음 완성]
```

### Spike 단계 게이트

- **6/6 통과** → Phase 1 본격 진행
- **3~5/6 통과** → 1주 연장 후 재평가
- **≤2/6 통과** → STOP, 큰 결정 다시 (이 spec의 §8 대안 옵션 참조)

## 5. Spike — 1주 검증 (Step 1)

### 목적

ADM 경로가 우리 환경(`stasel/WebRTC 147` + `#84` audio routing 정책)에서 실제로 동작하는지 정량 검증. 큰 작업(Phase 1) 들어가기 전 risk 노출.

### 범위

- 별도 브랜치 `spike/call-adm-replacement`
- 최소 구현: ADM이 통화 audio를 정상으로 흘려보내기만 (녹음 없음)
- `WebRTCPlugin`의 `RTCPeerConnectionFactory init`을 `audioDevice:` overload로 변경
- 우리 audio routing 정책(이어피스 default · `.voiceChat` · `.allowBluetoothHFP`)을 ADM 안에서 등가 구현

### 신규 파일 (Spike)

- `ios/App/App/AudioRecordingADM.swift` (~300~500 LOC, 녹음 코드 없는 최소 구현)
  - `RTCAudioDevice` protocol 구현 (initialize·terminate·startRecording·stopRecording·startPlayout·stopPlayout 등 ~20 메서드)
  - `AVAudioEngine` + `AVAudioSinkNode` (mic input) + `AVAudioSourceNode` (speaker output)
  - `AVAudioSession` 카테고리/모드 설정 (`.playAndRecord` + `.voiceChat` + iOS 17+ `.allowBluetoothHFP` 분기)
  - Interruption / route change observer (route change reason 필터로 `.override` self-trigger boomerang 방지 — #84 교훈)

### 수정 파일 (Spike)

- `ios/App/App/WebRTCPlugin.swift`
  - factory init을 `audioDevice:` overload로 변경
  - `AudioRecordingADM` 인스턴스 주입
  - 기존 `configureForCall` / `setSpeaker` / `endCall`의 audio session 통제 코드 일부 ADM 안으로 이전 (단 외부 JS API 시그니처는 보존 — JS 측 변경 0)

### 검증 시나리오 (실기기 6개)

| # | 시나리오 | 통과 기준 |
|---|---|---|
| ① | 통화 진입 (BT 미연결) | outputs = `["Receiver"]`, 이어피스에서 음성 들림 |
| ② | `setSpeaker(off)` 6회 | 모두 정상 토글, audio 끊김 없음 — **방안 2가 죽었던 정확한 지점** |
| ③ | `setSpeaker(on)` 6회 | 모두 정상 토글 |
| ④ | BT 헤드셋 연결/해제 | 자동 라우팅, ADM 정상 reinit |
| ⑤ | 통화 중 전화 수신 interruption | 통화 audio 정상 복귀 |
| ⑥ | 로그 검증 | `AudioSession::beginInterruption but session is already interrupted!` 경고 없음 |

### Spike 산출물

- 동작 여부 + 6/6 시나리오 결과 표
- 막힌 지점·이유·재현 명령
- 결과를 본 spec 마지막에 "Spike 결과" 섹션으로 추가 commit
- 별도 이슈/PR 없음 (브랜치만 보존)

## 6. Phase 1 — ADM 교체 PR (Step 2, Spike 통과 시)

### 목표

Spike 코드를 production 품질로 정리하고 머지. **기능 변경 없음** — 통화 audio 동작 동등성이 본질.

### 이슈

별도 생성: `refactor(call): default ADM → AVAudioEngine ADM 교체`

### 범위

- `AudioRecordingADM.swift` production 화 (테스트 + 문서 주석)
- `WebRTCPlugin.swift` 정리
- 단위 테스트 (가능한 범위 — ADM은 native라 unit test 어려움)
- 실기기 회귀 검증 + 1주 dogfooding 후 머지

### 회귀 검증 — 전수 시나리오

#84의 stash@{0}/{1}/{2} + 방안 1·2 실패 시나리오를 회귀 체크리스트로 변환:

| 시나리오 | 기대 동작 |
|---|---|
| 첫 진입 outputs | `["Receiver"]` (이어피스 default 보존) |
| 스피커 → 이어피스 토글 | 즉시 전환, 마이크 안 끊김 |
| 이어피스 → 스피커 토글 | 즉시 전환, 마이크 안 끊김 |
| 빠른 토글 5+회 | 모두 정확히 alternate, audio 끊김 없음 |
| 통화 중 BT 연결 | BT 자동 라우팅 |
| 통화 중 BT 해제 | 이어피스로 자동 복귀 |
| 통화 중 전화 수신 | interruption 후 정상 복귀 |
| 통화 중 Siri 호출 | interruption 후 정상 복귀 |
| 통화 종료 | audio session 정상 deactivate |

### 알려진 한계

- `AVAudioEngine` 기반 ADM이라 sample rate 변환·channel layout 변환을 우리가 통제
- mstyura 코멘트 그대로 "예제 수준" — interruption/device switch corner case는 우리가 직접 메움
- 회귀 risk Medium-High — Spike 통과 후에도 dogfooding 필수

## 7. Phase 2 — 녹음 + S3 PR (Step 3, Phase 1 머지 후)

### 목표

Phase 1의 ADM 위에 녹음 tap + S3 업로드 + startup recovery 추가. 이슈 #116 close.

### 사용자 흐름

```
[통화 진입 — status=connecting]
        │
        ▼
[connected 진입]
        │
        ├─ useCallRecording 자동 start
        │     └─ AudioRecorder.start({ roomId })
        │     └─ ADM의 AVAudioSinkNode block에서 PCM 파일 write 시작
        │     └─ Library/Caches/recordings/<roomId>.m4a 적재
        │
        ▼
[통화 화면 상단에 "● 녹음 중" 텍스트 indicator]
        │
        ▼
[end 버튼 / HANGUP / WS close / pc failed]
        │
        ▼
[useCallRecording cleanup]
        │
        ├─ AudioRecorder.stop() → 파일 finalize
        ├─ uploadRecording(roomId, filePath) 백그라운드 시작
        │   ① POST /calls/:roomId/recordings:presign
        │   ② PUT uploadUrl (파일 본문)
        │   ③ POST /calls/:roomId/recordings:complete
        │   성공 → 임시 파일 삭제
        │   실패 → 보존 (다음 startup recovery)
        │
        ▼
navigate("/")  (업로드 결과 안 기다림)

[다음 앱 실행 시 — App.tsx mount]
        │
        ▼
recordingRecovery() 1회 실행
        │
        ▼
Library/Caches/recordings/ 스캔
        │
        파일별:
        ├─ uploadRecording 재시도
        │   성공 → 삭제
        │   presign 401 (만료) → 삭제
        │   파일 헤더 깨짐 → 삭제 + Sentry
        │   네트워크 실패 → 보존 (다음 startup)
```

### Phase 2 신규/수정 파일

```
ios/App/App/AudioRecordingADM.swift                  # ← sink block에 file write 추가
                                                       startRecording/stopRecording JS bridge 추가
ios/App/App/WebRTCPlugin.swift                       # 변경 X (ADM이 알아서 함)

src/lib/native/audioRecorderPlugin.ts                # 신규 — JS wrapper
src/domains/call/recording/                          # 신규 디렉토리
  types.ts
  useCallRecording.ts
  useCallRecording.test.tsx
  recordingUploader.ts
  recordingUploader.test.ts
  recordingRecovery.ts
  recordingRecovery.test.ts
src/domains/call/api/
  recording.ts                                       # 신규 — presign/complete API client
  recording.test.ts
src/pages/call/
  CallPage.tsx                                       # ← useCallRecording 연결 + indicator
  CallPage.test.tsx                                  # ← 케이스 추가
  RecordingIndicator.tsx                             # 신규 — "● 녹음 중"
  RecordingIndicator.test.tsx
src/App.tsx                                          # ← mount 시 recordingRecovery 1회
src/mocks/handlers.ts                                # ← presign/complete MSW handler
```

### Phase 2 모듈 책임

| 모듈 | 책임 | 의존 |
|---|---|---|
| `AudioRecordingADM` (Swift) | sink block에서 `AVAudioFile.write`. start/stop/getFilePath/listPending/deleteFile JS bridge | AVAudioEngine |
| `audioRecorderPlugin.ts` | Capacitor bridge wrapper. iOS 아닌 환경에서는 no-op stub | `@capacitor/core` |
| `useCallRecording` | 통화 status에 반응해 start/stop. cleanup 시 업로드 호출 | `audioRecorderPlugin`, `recordingUploader` |
| `recordingUploader` | filePath + roomId → presign → PUT → complete. 멱등 | `api/recording`, `@capacitor/filesystem` |
| `recordingRecovery` | 앱 mount 시 폴더 스캔, 잔여 파일을 uploader에 위임 | `recordingUploader`, `@capacitor/filesystem` |
| `api/recording` | HTTP — presign·complete endpoint | `httpService` |

### BE API 스키마

상세 사양은 별도 문서: `docs/backend/2026-05-20-call-recording-api.md` (BE 팀 전달용).

핵심 사항만 요약:

```
GET  /matching/status
  → MatchingStatusResponse 에 callId: Long 신규 필드 (BE 작업)
     기존 roomId(UUID) 와 별개. call 안에 room 이 담긴 도메인 모델.

POST /calls/:callId/recording/presign
  callId: Long (Path variable)
  요청: { contentType: "audio/m4a", sizeBytes: number }
  응답 (envelope): { uploadUrl, storageKey, expiresAt }

PUT <uploadUrl>
  Content-Type: audio/m4a
  body: m4a raw bytes

POST /calls/:callId/recording/complete
  요청: { storageKey, durationMs, sizeBytes, codec: "aac", sampleRate: 24000 }
  응답 (envelope): { recordingId }
```

핵심 결정:
- recording 의 상위 resource = **call** (`/calls/`) — room 이 아님. call 안에 room 이 담긴 도메인 모델
- callId 타입 = **Long** (UUID 아님). roomId 는 UUID 유지 (signaling 용)
- recording singular (한 user × 한 call = 1 개) — `recordings/` plural 아님
- LingRing API 컨벤션 (`POST /me/withdraw` 류) 와 정합한 action style

### 인코딩 설정

| 항목 | 값 |
|---|---|
| Codec | AAC-LC |
| Sample rate | 24 kHz (음성 적합, STT 호환 충분) |
| Bitrate | 64 kbps |
| Channel | mono |
| Container | m4a |

10분 통화 ≈ 4.7 MB, 30분 ≈ 14 MB. 프로필 이미지 상한 30MB 대비 안전.

### 동의·indicator UX

- 약관/개인정보처리방침에 음성 처리 조항 명시 (Phase 2 머지 전 법무 검토)
- 통화 화면 상단에 "● 녹음 중" 텍스트 (작은 dot + 한글 라벨)
- 양당사자 모두 자기 발화만 녹음 → 한국 통신비밀보호법상 양당사자 동의 의무 없음

### 보존 정책

- S3 lifecycle 7일 (배포 전 재검토 항목)
- 사용자 탈퇴 시 즉시 hard-delete (메모리 `project_account_deletion_policy` 정책)
- 분석 완료 후 자동 삭제는 후속 작업

## 8. 알려진 한계 / 백업 옵션

### Spike 결과에 따른 분기

| Spike 결과 | 다음 행동 |
|---|---|
| 6/6 통과 | Phase 1 진행 |
| 3~5/6 통과 | 1주 연장, 막힌 시나리오 디버깅 |
| ≤2/6 통과 | STOP. 아래 백업 옵션으로 |

### 백업 옵션 (Spike 실패 시)

| 옵션 | 설명 | trade-off |
|---|---|---|
| **B1. iOS 보류 + Web/Android 먼저** | dev/Android W3C MediaRecorder만 ship. iOS는 별도 큰 이슈 (audio 전문 협업자 확보 시) | iOS 녹음 없음. 안전 |
| **B2. SFU/SaaS 전환** | P2P 포기. Daily / Cloudflare Realtime / AWS Chime SDK 중 선택. 서버 녹음 | BE 인프라 변경, 분당 비용, 마이그레이션 1~2개월. 단 architectural fit ↑ |
| **B3. ADM 재시도** | 추가 1~2주 자체 디버깅 | 시간 매몰 가능성 |

**기본 권장 escalation**: ≤2/6 시 즉시 B2 진지 검토. 메이저 회의 앱들이 모두 SFU + 서버 녹음으로 해결한 길이라 architectural fit이 더 좋음.

### 향후 변경 시 주의

- `AudioRecordingADM`은 `RTCAudioSession.useManualAudio` 가정 변경 — 기존 `WebRTCPlugin`의 audio session 통제 코드와 중복 영역 있음. ADM이 통제 주체임을 명확히
- `AVAudioSession.sharedInstance()` 직접 통제 절대 금지 — ADM 내부 또는 `RTCAudioSession.sharedInstance()`만 (memory `project_call_audio_routing` 참조)
- stasel/WebRTC 버전 업그레이드 시 `RTCAudioDevice` protocol signature 변경 점검
- iOS audio engine은 OS 메이저 버전마다 동작 미세 변경 — iOS 17/18/19 회귀 검증 필수

## 9. 검증

### 자동 테스트

```
npm run typecheck && npm run lint && npm run test:run && npm run coverage
```

커버리지 80%+ 유지 (CLAUDE.md 규칙). Native ADM은 단위 테스트 한계 있어 통합·실기기 검증 비중 ↑.

### 실기기 e2e (Phase 1 + Phase 2)

- §6의 회귀 시나리오 9개 + §5의 Spike 시나리오 6개
- Phase 2 추가: 통화 종료 → 임시 파일 존재 확인 → 업로드 성공 → 파일 삭제 확인
- Phase 2 추가: 통화 중 네트워크 끊김 → 통화 종료 → 임시 파일 보존 → 다음 앱 실행 → recovery로 업로드 성공

### 측정 포인트

- Phase 1 머지 후 1주 dogfooding 동안 통화 audio 끊김·indicator 회귀 모니터링
- Phase 2 후 S3 업로드 성공률 (목표 95%+ 첫 시도, 99%+ recovery 포함)

## 10. 참고 자료

### Apple 공식

- [RTCPeerConnectionFactory init audioDevice: overload (stasel/WebRTC 147 헤더)](https://github.com/stasel/WebRTC) — 우리 빌드 헤더 직접 확인
- [Apple Forum 821942 — VPIO + RemoteIO 공존 불가 (DTS 공식 답변)](https://developer.apple.com/forums/thread/821942)
- [Apple Forum — Using VoiceProcessingIO and RemoteIO Audio Units](https://developer.apple.com/forums/thread/655091)
- [Apple — Responding to audio route changes](https://developer.apple.com/documentation/avfaudio/responding-to-audio-route-changes)
- [Apple — setVoiceProcessingEnabled docs](https://developer.apple.com/documentation/avfaudio/avaudioionode/setvoiceprocessingenabled(_:))

### WebRTC 공식

- [WebRTC ADM 공식 문서 — external ADM injection](https://webrtc.googlesource.com/src/+/HEAD/modules/audio_device/g3doc/audio_device_module.md)
- [discuss-webrtc — iOS native WebRTC recording (OnDeliverRecordedData/OnGetPlayoutData 권장)](https://groups.google.com/g/discuss-webrtc/c/FJx3QOlRe7E)

### Prior art (패턴 학습용, copy 불가)

- [mstyura/RTCAudioDevice — WebRTC 헤더가 endorse한 sample (4년 stale, 패턴만)](https://github.com/mstyura/RTCAudioDevice)
- [Jitsi Meet PR #15534 — iOS RTCAudioDevice injection API hook (saghul, 2025-02-04 merged)](https://github.com/jitsi/jitsi-meet/pull/15534)
- [shiguredo/sora-ios-sdk — RTCAudioDeviceModule wrapper (자체 fork이지만 패턴 참고)](https://github.com/shiguredo/sora-ios-sdk)
- [GetStream/stream-video-swift — RTCAudioDeviceModuleControlling abstraction](https://github.com/GetStream/stream-video-swift)

### 선행 조사 문서

- `IOS_AUDIO_ROUTING_INVESTIGATION.md` — #84 1차 (WKWebView 한계 확정)
- `IOS_AUDIO_ROUTING_REVISITED.md` — #84 2차 + 방안 3 commit (stasel/WebRTC 도입)
- `docs/superpowers/specs/2026-04-29-voice-p2p-connection-design.md` — P2P 통화 + native libwebrtc

## 11. 결정 로그

이 spec에 도달하기까지의 핵심 결정:

| 시점 | 결정 | 근거 |
|---|---|---|
| 브레인스토밍 초기 | 자기 마이크만 녹음 (uplink only) | 화자 분리 + 데이터량 + ADM 단순성 |
| 브레인스토밍 중반 | iOS 우선, Web/Android는 후속 | 사용자 선택 — 출시 우선순위 |
| ADM 발견 후 | ADM 경로가 유일 (다른 경로 모두 막힘) | 전수 조사 §2 표 |
| Prior art 조사 | mstyura/LiveKit/Sora 등 모두 copy 불가, 패턴만 학습 | stasel/WebRTC 147 API 호환성 |
| Niche 영역 인지 | risk 명시 + Spike 게이트 + 백업 옵션 spec에 포함 | "검색해도 안 나오는 길"의 reality check |
| 진행 결정 | ADM 강행 (Spike 우선) | 사용자 결정 — "한 번에 될 수도, sunk cost 보존" |

이 결정 로그가 향후 누가 spec을 봐도 "왜 이 길인가"가 재현되도록 남김.

## 12. Spike 결과 (2026-05-19)

### 시나리오 결과

| # | 시나리오 | 결과 | 비고 |
|---|---|---|---|
| ① | 통화 진입 outputs (이어피스 default) | ✅ PASS | — |
| ② | setSpeaker(off) 6회 — **방안 2가 죽었던 지점** | ✅ PASS | audio stuck 없음 |
| ③ | setSpeaker(on) 6회 | ✅ PASS | — |
| ④ | BT 헤드셋 연결/해제 자동 라우팅 | ✅ PASS | — |
| ⑤ | 통화 중 전화 수신 interruption 복귀 | ✅ PASS | — |
| ⑥ | `AudioSession::beginInterruption` 류 경고 | ✅ PASS | console 깨끗 |

**총: 6/6 통과**

### 게이트 평가

- 6/6 통과 → **Phase 1 본격 진행** ✅

### Spike 중 발견한 핵심 fix (Phase 1 에서 보존)

| Fix | 커밋 | 원인 |
|---|---|---|
| `delegate` getter/setter 재진입 deadlock | `e38622a` | `queue.sync` 안에서 `updateEngine()` 호출, `updateEngine()`이 `delegate` getter (또 `queue.sync`) → 재진입 EXC_BREAKPOINT. `queueKey`/`queueValue` 로 큐 컨텍스트 검사 후 reentrancy-safe 처리 |
| channel count mono(1) 통일 | `3062ad3` | libwebrtc 는 internal mono. HW stereo 시 rtcFormat=2 면 `AVAudioPCMBuffer` buffer/format mismatch 경고. mono 고정 + `SimpleAudioConverter` 가 stereo→mono mixing |
| BT 연결 audio speed 깨짐 — AVAudioEngineConfigurationChange observer | `1b77844` | BT 연결 시 HW sample rate 변경되나 AVAudioEngine 자동 적응 안 함 → audio speed 깨짐. observer 등록해 변경 시 engine 재구성 |
| BT 연결 audio speed 깨짐 — route change 에서 직접 engine 재시작 | `4714e95` | VPIO 환경에서 위 observer 만으로는 안 발화하는 케이스. handleRouteChange 의 `.newDeviceAvailable` / `.oldDeviceUnavailable` 에서 engine 재시작 직접 트리거 |

### 잔여 미세 이슈 (Phase 1 또는 후속에서 보완)

| 항목 | 현재 상태 | 보완 방향 |
|---|---|---|
| BT 연결 시 audio speed | 성공률 높음, 가끔 깨짐 (사용자 보고) | engine 재시작 race·timing 보강. sample rate explicit 비교 후 재시작 여부 판단 |

### Spike 브랜치 보존

### Spike 브랜치 보존

`spike/call-adm-replacement` 브랜치는 머지하지 않고 보존. Phase 1 작업이 이 브랜치 코드를 base로 production 화하여 별도 PR.

### 다음 단계

Phase 1 plan 작성 (`docs/superpowers/plans/2026-05-19-call-recording-phase1.md`) → 별도 이슈 (`refactor(call): default ADM → AVAudioEngine ADM 교체`) 생성 → 별도 브랜치에서 production 작업.
