# Android 네이티브 WebRTC 전환 — 타당성 조사 & 단계 Plan (#193)

2026-07-10 · 결론: **가능. 단, Phase 0 스파이크(반나절)로 기기 실측 후 본 구현 착수 권장.**

## 왜 전환하는가 (요약)

Chromium WebView 가 WebRTC 오디오 라우팅을 소유해 이어피스 전환이 원천 불가 (#190 실측:
setCommunicationDevice 수락 후 즉시 스피커로 재지정, setSinkId 미지원, 출력 기기 "default"만 노출).
iOS 는 같은 벽을 #84 방안 3(네이티브 libwebrtc)으로 해결했고, Android 도 같은 길을 간다.

## 타당성 — 검증된 사실

| # | 가정 | 판정 | 근거 |
|---|---|---|---|
| 1 | 유지보수되는 프리빌트 libwebrtc SDK 존재 | ✅ | [GetStream/webrtc-android](https://github.com/GetStream/webrtc-android) — Google 의 중단된 google-webrtc 를 대체하는 활성 프로젝트, [Maven Central v1.3.10](https://central.sonatype.com/artifact/io.getstream/stream-webrtc-android) |
| 2 | 마이크 PCM 탭(녹음) 가능 | ✅ | `JavaAudioDeviceModule.Builder.`[`setSamplesReadyCallback`](https://getstream.github.io/webrtc-android/stream-webrtc-android/org.webrtc.audio/-java-audio-device-module/-builder/set-samples-ready-callback.html) — AudioRecord 원본 PCM 콜백. "내 마이크만 녹음" 정책과 정확히 일치. Twilio 등 상용 SDK 도 동일 API 노출 |
| 3 | 이어피스/스피커 라우팅 제어 가능 | ✅ (실측 필요) | 네이티브 스택은 `WebRtcAudioTrack` 이 `USAGE_VOICE_COMMUNICATION` 으로 재생 → `MODE_IN_COMMUNICATION` + `setCommunicationDevice` 가 정상 적용되는 표준 VoIP 경로. [Jitsi AppRTCAudioManager](https://github.com/jitsi/android-webrtc/blob/master/src/org/jitsi/androidwebrtc/AppRTCAudioManager.java) 가 canonical 레퍼런스. **크로미움이 경로에서 사라지므로 #190 의 핑퐁 전쟁 자체가 소멸** |
| 4 | JS 계약 재사용 | ✅ | `webrtcPlugin.ts` 인터페이스 + `peerConnection.ts` `createNativePeerSession` 이 iOS 로 검증 완료 — Kotlin 으로 동일 계약 구현만 하면 JS 는 플랫폼 분기 변경만 |
| 5 | 에코 캔슬레이션 | ✅ | `JavaAudioDeviceModule` 기본이 HW AEC(가능 기기) + SW 폴백 — iOS 의 VPIO 수동 구성보다 단순 |

## 리스크 (스파이크로 실측할 것)

1. **삼성 CARSM 변수**: 네이티브 VoIP 앱의 표준 동작이라 위험 낮음이나, S20+ 실기기에서 이어피스 기본 + 토글을 Phase 0 에서 반드시 실측.
2. **PCM→m4a 인코딩**: samplesReadyCallback 은 PCM — `MediaCodec`(AAC) + `MediaMuxer` 파이프라인 필요. 표준 기술이지만 통화 내내 인코딩하는 수명 관리(백그라운드·강제종료)는 iOS #184 계열 교훈 적용.
3. **APK 크기**: libwebrtc AAR 로 +10~20MB 예상 — Play 정책 무관 수준이나 인지할 것.
4. **회귀 면적**: 통화 연결성(시그널링은 그대로), 녹음 업로드 계약(BE 화이트리스트 audio/mp4 ← AAC/m4a 적합), #187 디스크 보존 대체.
5. **iOS #191 교훈 선반영**: 라우트 체인지 → 엔진 재구성 로직을 넣게 되면 부메랑 가드(시그니처 비교)를 처음부터.

## 단계 Plan — 각 단계에 검증 게이트

### Phase 0 — 스파이크 (반나절) ← "가능한가"의 최종 판정
- stream-webrtc-android 의존성 추가, 최소 PeerConnection + JavaAudioDeviceModule 기동
- **게이트**: S20+ 실기기에서 ① 오디오가 이어피스로 기본 재생 ② setCommunicationDevice(스피커↔이어피스) 토글 실효 ③ samplesReadyCallback 에 PCM 도착 — 셋 다 확인되면 GO, 하나라도 실패 시 중단하고 재평가

### Phase 1 — 시그널링·미디어 패리티
- `WebRTCPlugin.kt`: createPeerConnection/start/offer/answer/ICE/setMicEnabled/close + 3개 이벤트 (iOS `WebRTCPlugin.swift` 계약 복제)
- `peerConnection.ts` 분기를 Android→native 로 전환
- **게이트**: iOS↔Android 실통화 연결 + 양방향 음성 (기존 web 경로와 A/B)

### Phase 2 — 오디오 라우팅
- configureForCall(이어피스 기본)/setSpeaker/endCall 을 플러그인 내부 AudioManager 로 (#190 조사 코드 재활용)
- **게이트**: 이어피스 기본 실측 + 토글 왕복 + BT 이어폰 간섭 없음

### Phase 3 — 녹음
- samplesReadyCallback → MediaCodec(AAC)/MediaMuxer → m4a 파일, start/stop/listPending/delete/uploadRecordingFile 구현 (iOS 파일 보존+recovery 패턴)
- `callRecorder.ts` Android 분기를 iOS 와 동일 native 경로로, #187 MediaRecorder 경로 제거
- **게이트**: 녹음 업로드 → BE 분석까지 E2E (webm→m4a 전환에 BE STT 영향 없는지 확인)

### Phase 4 — 정리·출시
- web 경로 통화 코드 정리, #55(FGS) 와 결합해 백그라운드 통화까지 QA, 릴리스 노트

## 범위 밖
- TURN 서버 (별도 인프라 티켓 — 네이티브 전환과 무관하게 필요)
- 시그널링 신뢰성(READY 재발행 등) — 별도

Sources: [GetStream/webrtc-android](https://github.com/GetStream/webrtc-android) · [Maven Central](https://central.sonatype.com/artifact/io.getstream/stream-webrtc-android) · [setSamplesReadyCallback docs](https://getstream.github.io/webrtc-android/stream-webrtc-android/org.webrtc.audio/-java-audio-device-module/-builder/set-samples-ready-callback.html) · [Jitsi AppRTCAudioManager](https://github.com/jitsi/android-webrtc/blob/master/src/org/jitsi/androidwebrtc/AppRTCAudioManager.java) · [discuss-webrtc: Audio routing on native Android](https://groups.google.com/g/discuss-webrtc/c/Pqag6R7QV2c)
