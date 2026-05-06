# iOS 통화 audio routing 재조사 (#84) — REVISITED

작성일: 2026-05-06
관련 이슈: [#84 — fix: 스피커폰 동작 안 함](https://github.com/LingRing-Speaking/LingRing-FE/issues/84)
선행 문서: `IOS_AUDIO_ROUTING_INVESTIGATION.md` (이 문서는 그 결론을 외부 출처로 검증·반박)

---

## TL;DR

선행 문서는 "WKWebView WebRTC + 외부 AVAudioSession 조작은 architectural limitation 으로 이어피스 자동 + 토글 양방향 + audio 안정 세 가지를 동시에 만족 불가" 라고 결론지었음. 본 재조사 결과 **이 결론은 너무 강함**.

선행 문서가 fundamental 이라 본 부분 다수가 실제로는:

- **timing 문제** — WebKit RTC engine 의 reconfig 가 끝나기 전에 외부에서 `setActive(true)` 호출 → race
- **observer self-trigger 의 코딩 패턴 문제** — `.override` reason 필터링 누락 → boomerang loop
- **iOS 18 자동재생 차단** — `mediaTypesRequiringUserActionForPlayback` 미설정

세 가지로 분리되며, 각각 표준 회피 패턴 존재.

목표 (이어피스 default + 양방향 토글 + 안정 audio) 는 **방안 1** 으로 도달 가능성 높음. 실패 시 fallback 으로 방안 2 (정책 양보) → 방안 3 (native libwebrtc) → 방안 4 (통화 화면만 native) 로 escalate.

---

## 외부 출처 확인 요약

### 1. Apple DTS 공식 답변 ([Forum 821942](https://developer.apple.com/forums/thread/821942))

> "WKWebView manages its own `AVAudioSession` configuration internally when WebRTC captures audio via `getUserMedia()`. That internal configuration **may trigger a route change**, which would **reset a prior `overrideOutputAudioPort:` call**."

→ "별도 audio engine layer" 가 아니라 **같은 AVAudioSession 을 WebKit 도 건드리니 외부 override 가 reset 될 수 있다** 라는 의미. metadata vs engine 분리가 아니라 **연속된 route 변경의 race**.

### 2. Saúl Ibarra Corretgé (saghul, WebRTC core 메인테이너) — discuss-webrtc

[44ogyfkIC0w](https://groups.google.com/g/discuss-webrtc/c/44ogyfkIC0w):
> "The override will be reset when the session is reconfigured. If you choose the video chat mode, it defaults to the speaker."

[MWaKZahH1i8](https://groups.google.com/g/discuss-webrtc/c/MWaKZahH1i8):
> "Success depends on calling speaker routing **after you receive RTCMediaStream from other peer**, suggesting the WebRTC engine resets audio configuration upon stream establishment."

→ **카테고리·모드는 durable, override 는 temporary**. 그리고 적용 시점은 **stream 확립 후** 가 안전.

### 3. Apple — Responding to audio route changes (route change reason 가이드)

[공식 가이드](https://developer.apple.com/documentation/avfaudio/responding-to-audio-route-changes):
> "treat route changes as authoritative ... apps should pause playback if the reason is `AVAudioSessionRouteChangeReasonOldDeviceUnavailable`, but should not if the reason is `AVAudioSessionRouteChangeReasonOverride`"

→ `AVAudioSession.RouteChangeReason` 으로 본인 발화 vs 외부 발화 구분 가능. boomerang 차단의 공식 메커니즘.

### 4. iOS 18 WKWebView WebRTC audio 자동재생 차단 ([Forum 764453](https://developer.apple.com/forums/thread/764453))

> "Finally I found the solution to the audio issue with WebRTC in WKWebView on iOS. The key was to add: `webViewConfiguration.mediaTypesRequiringUserActionForPlayback = []`. This resolved the issue, and now audio plays correctly without requiring user action."

→ iOS 18 에서 WebRTC audio 가 사용자 인터랙션 없이는 재생 안 되는 case. 우리 코드에 이 설정 흔적 없음 — 수정 필요.

### 5. Capacitor #8176 ([cold start race](https://github.com/ionic-team/capacitor/issues/8176))

> "WKWebView (the wrapper that capacitor and many others are using) starts cold ... When WebRTC/audio starts, Safari often has the route + sample rate 'hot,' so first playback is smooth"

→ AppDelegate 단계의 setActive(true) 가 race 의 정확한 원인. 이건 선행 문서와 일치.

---

## 선행 문서가 안 된다 한 것 중 실제로는 될 가능성 높은 4가지

### A. "outputs metadata 만 바뀌고 실제 audio 는 스피커" — race artifact 가능성

선행 문서 §1 핵심 관찰:
> "session.currentRoute.outputs 가 [Receiver] 로 변경됐는데도 사용자는 여전히 스피커로 들리는 케이스 발견 → metadata layer 만 영향, 실제 audio engine layer 는 WebKit RTC 가 별도로 관리"

**반박 근거**: Apple DTS 답변 (출처 1) 은 layer 분리가 아니라 **WebKit 의 후속 reconfig 이 prior override 를 reset** 한다는 메커니즘 설명. 우리가 metadata 를 봤을 때는 override 가 적용됐고, 그 직후 WebKit reconfig → 다시 Speaker 로 돌아간 것. **metadata 와 audio 는 같은 layer**. 이는 다음 B 의 observer 처리로 해결 가능.

### B. observer 자동 보정의 boomerang — 코딩 패턴 이슈, 회피 가능

stash@{1} 의 handleRouteChange 가 reason 필터 없이 매번 보정 호출 → 자기 발화로 인한 .override notification 이 다시 보정 트리거 → 200ms 내 4-5회 누적 발화 → audio engine 흔들림 → 끊김.

**회피 패턴**: route change reason 으로 분기.
- `.override` (= 우리 호출 자체) → 무시
- `.categoryChange` / `.routeConfigurationChange` → 보정 대상
- `.newDeviceAvailable` / `.oldDeviceUnavailable` → 시스템 우선, 보정 안 함
- BT/wired headset 연결 시점 → 외부 device 우선, 보정 안 함

stash@{1} 가 **자동 보정 자체를 제거**해버린 것은 과한 후퇴. 표준 reason 필터로 boomerang 만 막으면 됨 (Apple 공식 가이드 패턴).

### C. setActive(true) race — 호출 시점 변경으로 회피

선행 문서 §1 setActive 부작용 표는 모두 시점이 빠름:
- AppDelegate didFinishLaunching — RTC startup 과 race
- peer.start() 직후 — 동일 race
- onConnected 시점 — 잠깐 race + 일부 끊김

**놓친 시점**: `onConnectionStateChange === "connected"` **그리고** 첫 ontrack 둘 다 발생 후. saghul 의 "after stream establishment" 인용과 일치.

**더 안전한 path**: 그 시점에도 **setActive(true) 호출 안 함**. WebKit 이 이미 active 한 상태이므로, 우리는 카테고리/옵션/override 만 설정. 토글 OFF 방향에서만 setActive(true) 동반 (실측: override 만으론 회귀 안 됨).

### D. Apple 공식 권장 패턴 — 정확한 형태로 안 시도됨

Apple DTS 가 직접 권장한 형태 (출처 1):
```swift
session.setCategory(.playAndRecord,
                    options: [.defaultToSpeaker, .allowBluetooth])
session.setActive(true)
```

이는 **default 가 Speaker** 라는 가정. memory 의 정책 ("이어피스 기본, .defaultToSpeaker 금지") 와 충돌. 정책 변경 동반 시 Apple 이 보증하는 가장 robust 한 형태. 방안 2 의 base.

---

## 명확하게 안 되는 것 (검증 완료)

| 항목 | 출처 |
|---|---|
| WKWebView 에서 `RTCAudioSession` 외부 직접 호출 | Apple DTS — RTCAudioSession 은 native libwebrtc 전용. WebKit 의 내부 RTC 엔진은 외부에 노출 안 됨 |
| cordova-plugin-iosrtc-capacitor 의 번들 WebRTC.framework (M69, 2018) 도입 | npm 패키지 자체 노후 + arm64 simulator slice 부재 + SPM `.framework` link 미지원 (선행 문서 §3) |
| CallKit 단독 + WKWebView WebRTC | 선행 문서 §2 spike + [dotnet/macios#18078](https://github.com/dotnet/macios/issues/18078) — WebKit RTC 가 CallKit audio activation 인식 못 함 |
| AppDelegate didFinishLaunching 의 setActive(true) | 선행 문서 §1 + [react-native-webrtc setActive thread](https://react-native-webrtc.discourse.group/t/ios-no-sound-after-setactive/33) |

---

## 방안 (우선순위 순)

### 방안 1 ★ — timing + reason 필터 + iOS 18 fix (현재 채택)

stash@{1} 의 코드를 base 로 3가지 갭만 메움:

1. configureForCall 호출 시점을 `peer.start()` 직후 → `onConnectionStateChange === "connected"` 로 이동
2. handleRouteChange 에 reason 필터 + intent 비교 + 1회 보정 추가 (boomerang 차단)
3. MainViewController 의 viewDidLoad 에서 `webView.configuration.mediaTypesRequiringUserActionForPlayback = []` 설정

작업량: 1-2일. 실측 검증 필요 (실기기).
계획 상세: `/Users/spqje/.claude/plans/1-compressed-canyon.md`

### 방안 2 — 정책 양보, `.defaultToSpeaker` (fallback)

`session.setCategory(.playAndRecord, options: [.defaultToSpeaker, .allowBluetoothHFP])` + `setActive(true)`. memory 정책 ("이어피스 기본") 변경 동반. UX 가 일반 전화와 다르지만 (스피커폰 default) Apple 이 보증하는 패턴이라 가장 안정적.

작업량: 0.5일. 정책 합의가 critical path.

### 방안 3 — stasel/WebRTC xcframework 도입 + 자체 plugin

[stasel/WebRTC-iOS](https://github.com/stasel/WebRTC-iOS) 는 최신 libwebrtc 를 `.xcframework` 로 배포 → SPM `binaryTarget` 직접 호환. 선행 문서가 막힌 cordova fork 의 두 가지 한계 (M69 노후 + .framework 비지원) 를 동시에 해결. 자체 thin Capacitor plugin 으로 `RTCAudioSession` 통제.

작업량: 1-2주. peerConnection.ts 의 W3C API 호출을 native bridge 로 옮김. IPA 크기 +10-15MB.

### 방안 4 — 통화 화면만 native (architectural pivot)

매칭/통화 외 UI 는 WKWebView 유지, 통화 화면만 native UIViewController + libwebrtc + RTCAudioSession. CallKit 정상 동기화 + 잠금 화면 통화 + 백그라운드 audio 모두 해결. 가장 큰 변경.

작업량: 2-3주.

---

## 다시 시도하는 사람이 봐야 할 것

선행 문서의 "향후 작업 시 우선 검토할 것" 보강:

1. **선행 문서의 §1 핵심 관찰 ("metadata vs audio engine layer 분리") 은 race artifact 일 가능성 높음** — 본 문서 §A 참조. Apple DTS 답변 (Forum 821942) 이 layer 분리가 아닌 reconfig race 메커니즘으로 정확히 설명함.
2. **방안 1 spike 는 stash@{1} base 에 3가지 갭만 메움** — 처음부터 만들지 말 것.
3. **route change reason 필터링은 [Apple 공식 가이드](https://developer.apple.com/documentation/avfaudio/responding-to-audio-route-changes)** 에 정확히 명시. boomerang 차단의 표준 패턴.
4. **iOS 18 audio 차단** — `webViewConfiguration.mediaTypesRequiringUserActionForPlayback = []` ([Forum 764453](https://developer.apple.com/forums/thread/764453)) 빠뜨리지 말 것.
5. **방안 1 이 실패하면** 방안 2 로 escalate 전 다음 측정값을 확보:
   - configureForCall 호출 시점에 `[AudioRoute] configureForCall — outputs=[?]` 로그
   - 그 이후 1초간의 모든 route change notification (reason + outputs)
   - WebKit 의 reconfig 횟수와 시점
6. **stash@{0} 의 CallKit spike 는 방안 3 도입 후에만 의미 있음** — RTCAudioSession 없이는 audio engine 동기화 불가.

---

## 참고 자료 (본 재조사 추가분)

선행 문서의 출처에 더해:

### Apple 공식
- [Apple DTS Forum 821942 — Issues with monitoring and changing WebRTC audio (Apple DTS 공식 답변)](https://developer.apple.com/forums/thread/821942)
- [Apple Forum 764453 — WKWebView can not play audio with webrtc on iOS 18](https://developer.apple.com/forums/thread/764453)
- [Apple — Responding to audio route changes](https://developer.apple.com/documentation/avfaudio/responding-to-audio-route-changes)
- [Apple — AVAudioSession.RouteChangeReason](https://developer.apple.com/documentation/avfaudio/avaudiosession/routechangereason)

### WebRTC 메인테이너
- [discuss-webrtc — WebRTC iOS Audio routed to internal speakers after Connected (saghul)](https://groups.google.com/g/discuss-webrtc/c/44ogyfkIC0w)
- [discuss-webrtc — internal and external speaker in WebRTC iOS](https://groups.google.com/g/discuss-webrtc/c/MWaKZahH1i8)

### WebRTC SDK fork
- [stasel/WebRTC-iOS — 최신 libwebrtc xcframework SPM fork (방안 3 의 base)](https://github.com/stasel/WebRTC-iOS)

### 기타 토론
- [react-native-webrtc discourse — iOS no sound after setActive](https://react-native-webrtc.discourse.group/t/ios-no-sound-after-setactive/33)
- [Mastering VoIP Audio with CallKit and WebRTC on iOS (Medium, RTCAudioSession 패턴)](https://medium.com/@tsivilko/mastering-voip-audio-with-callkit-and-webrtc-on-ios-0f2092402331)
- [flutter-webrtc PR #1941 — Speaker toggle override fix (sanity check)](https://github.com/flutter-webrtc/flutter-webrtc/pull/1941)

---

## 결론 — 방안 1 spike 결과 + 방안 2 commit (2026-05-06)

### 방안 1 (이어피스 default) 실측 결과

| 항목 | 결과 | 비고 |
|---|---|---|
| 첫 진입 outputs | ❌ ["Speaker"] | `override(.none)` 호출했음에도 WebKit 자연 default 인 Speaker 로 잡힘 |
| boomerang 발생 | ⚠️ 4회 correction loop | `categoryChange/routeConfigurationChange` 노티가 4회 발화. 매 보정 호출이 라우트 이동 못 시킴 (override 단독 한계) |
| 사용자 토글 양방향 | ✅ 6회 모두 정상 | `setSpeaker(off)` 는 `setActive+setCategory+override` 조합으로 Speaker→Receiver 이동 성공. `setSpeaker(on)` 은 `override(.speaker)` 만으로 Speaker 로 이동 |
| 마이크 끊김 | ✅ 없음 | 통화 종료까지 audio 안정 |
| WebContent interruption 경고 | ⚠️ 1회 (setSpeaker(off) 시) | benign — 이후 토글 5회 더 진행해도 audio 끊김 없음 |

### 근본 원인 재진술

WKWebView WebRTC 의 audio engine 이 `.playAndRecord + .voiceChat` 에서 자연 default 를 Speaker 로 잡고, **connection-establishment 시점에는 WebKit 이 자체 reconfig burst 를 일으켜 외부 `override(.none)` 의 효과를 reset 시킴**. mid-call 의 사용자 토글 시점에는 `setActive(true)` 동반이 effective 한 라우트 이동을 일으키지만, 첫 진입 시점의 setActive 는 race 위험으로 회피해야 함 (선행 조사가 옵션 매트릭스로 확인).

### 방안 2 (스피커 default) commit 결정 근거

1. **systematic-debugging 가이드 임계점**: stash@{2}/stash@{1}/stash@{0}/방안 1 → 4번째 시도. "3+ failed → architecture 의문" 트리거.
2. **자연 동작과의 정합**: WebKit 의 자연 default 가 Speaker → 의도값을 Speaker 로 일치시키면 fight 없음, boomerang 안 발화.
3. **Apple 공식 권장과 정합**: DTS Forum 821942 가 `.defaultToSpeaker` 를 명시 권장. 우리는 옵션은 추가 안 하지만 (Receiver 토글 path 보존 위해) "스피커 default" 의도는 Apple 권장 방향과 일치.
4. **사용자 3 요구사항 보존**:
   - 스피커 → 이어피스 변환: `setSpeaker(off)` path **변경 없음** — 6회 검증됨
   - 이어피스 → 스피커 변환: `setSpeaker(on)` path **변경 없음** — 6회 검증됨
   - 마이크 끊김 없음: setActive 호출 횟수/시점 **변경 없음** — 검증됨
5. **변경 범위 최소**: 의도 초기값 (Swift 2줄 + JS 1줄 + 테스트 보정 + memory 갱신) 만. 토글/observer/category/MainViewController 모두 그대로.

### 향후 이어피스 default 복원 path

memory 정책에 명시된 대로, 이어피스 default 를 다시 가능하게 하려면 **방안 3 (native libwebrtc 도입)** 이 prerequisite. `RTCAudioSession` 직접 통제 가능해야 connection-establishment 시점에 WebKit reconfig 와 동기화하며 외부 의도 (Receiver) 를 라우팅에 반영할 수 있음. [stasel/WebRTC-iOS](https://github.com/stasel/WebRTC-iOS) 의 `.xcframework` 가 SPM `binaryTarget` 호환 — 1-2주 작업 견적.

방안 3 도입 전까지는 스피커 default 가 ship 가능한 가장 견고한 형태.

---

## 방안 3 Phase 0 검증 결과 (2026-05-06)

방안 2 ship 후 사용자 테스트에서 **첫 setSpeaker(off) 시 audio 영구 stuck** 확인. WebKit audio engine state machine corruption — 외부 framework 으로 회피 불가능. 방안 3 (native libwebrtc) 로 escalate.

[stasel/WebRTC](https://github.com/stasel/WebRTC) M147 도입 가능성 검증 (Phase 0):

| # | Assumption | 결과 | 측정값/근거 |
|---|---|---|---|
| 1 | stasel/WebRTC + Capacitor 8 SPM resolve | ✅ | `xcodebuild -resolvePackageDependencies` 통과. WebRTC 147.0.0 다운로드 확정. **단**: `npx cap sync ios` 가 매번 `Package.swift` 를 wipe → npm script 로 자동 재주입 hook 필요 (Phase 0.5) |
| 2 | Apple Silicon simulator slice | ✅ | `ios-x86_64_arm64-simulator` 슬라이스에 arm64 + x86_64 동시 포함 |
| 3 | iOS 15 deployment 호환 | ✅ | `xcodebuild ... -destination 'generic/platform=iOS Simulator' build` 통과 — `BUILD SUCCEEDED` |
| 4 | IPA 영향 | ✅ | `WebRTC.framework` 의 ios-arm64 slice = **12MB** (실 device IPA 영향 추정). simulator fat slice = 26MB (시뮬레이터만, IPA 영향 X). 예상 +15-25MB 보다 적음 |
| 5 | Privacy Manifest 동봉 | ✅ | xcframework 안에 `PrivacyInfo.xcprivacy` 동봉됨. declared API: `SystemBootTime` (35F9.1, 8FFB.1) + `FileTimestamp` (C617.1). NSPrivacyCollectedDataTypes 빈 배열, NSPrivacyTracking false. **우리 PrivacyInfo.xcprivacy 추가 declaration 불필요** (Apple 가 framework manifest 자동 합침) |

**결론**: 5/5 PASS. native libwebrtc 도입 진행 가능. Phase 1 (WebRTCPlugin scaffold) 시작 조건 충족.

**Phase 0.5 추가 작업** (Phase 1 시작 전 필수):
- `Package.swift` 의 stasel/WebRTC 의존성을 `npx cap sync ios` 후 자동 재주입하는 npm script 추가 (Phase 0 검증 중 cap CLI 가 매번 wipe 하는 것 확인됨).

---

## 방안 3 commit 결과 (Phase 1~6 완료)

### Phase 별 deliverable

| Phase | 작업 | 결과 |
|---|---|---|
| 0 | 사전 검증 (5 critical assumption) | 5/5 PASS — IPA +12MB, simulator slice 포함, Privacy Manifest 동봉 |
| 0.5 | cap sync wipe 자동 보정 | `scripts/inject-webrtc-spm.mjs` + `npm run sync:ios` |
| 1 | WebRTCPlugin.swift scaffold | RTCPeerConnectionFactory + lifecycle + SDP + ICE + setMicEnabled + delegate events |
| 2 | RTCAudioSession 통제 | configureForCall / setSpeaker / endCall (`useManualAudio` + `lockForConfiguration` 패턴) |
| 3 | JS bridge | `webrtcPlugin.ts` (TypeScript wrapper), `audioRoute.ts` 를 NativeWebRTC 로 forward (시그니처 보존) |
| 4 | peerConnection.ts native path | `isIosNative()` 분기 → `createNativePeerSession`. PeerSession interface 그대로 유지 → useCallSession.ts 변경 minimum |
| 5 | native path 단위 테스트 | `peerConnection.native.test.ts` 14개. MediaStream polyfill 추가 |
| 6 | 정리 + 정책 복원 | AudioRoutePlugin.swift 제거, isSpeakerOn 초기값 false (이어피스 default 정책 복원) |

### 검증 결과

- **단위 테스트**: 348/348 (web path + native path 모두 green)
- **타입체크 + lint**: clean
- **iOS 빌드**: simulator generic destination BUILD SUCCEEDED
- **IPA 영향**: ios-arm64 slice = 12MB (예상 +15-25MB 보다 적음)

### 사용자 실기기 검증 시나리오

```bash
npm run dev:ios        # build + cap sync + WebRTC 의존성 재주입
open ios/App/App.xcodeproj
```

Xcode 에서 실기기 배포 후 다음 표대로 검증:

| 시나리오 | 기대 동작 | 방안 2 와의 차이 |
|---|---|---|
| 통화 진입 (BT 미연결) | **이어피스에서 들림** (정책 복원) | 방안 2 는 스피커 |
| 스피커 → 이어피스 토글 | 즉시 이어피스 전환, **마이크 안 끊김** | 방안 2 는 audio 영구 stuck |
| 이어피스 → 스피커 토글 | 즉시 스피커 전환, 마이크 안 끊김 | 동일 (양쪽 다 OK 였음) |
| 빠른 토글 5+회 | 모두 정확히 alternate, audio 끊김 없음 | 방안 2 는 첫 토글 후 죽었음 |
| 통화 중 BT 헤드셋 연결 | BT 자동 라우팅 | RTCAudioSession 가 시스템 라우팅 우선 |
| 통화 종료 | `WebRTCPlugin.endCall` 호출 | n/a |

### 로그 검증 포인트

- `AudioSession::beginInterruption but session is already interrupted!` 경고 **사라져야 함** — 방안 2 의 시그니처 issue. native libwebrtc 가 자체 audio engine 통제하므로 외부 시그널 mismatch 없음.
- `[WebRTC] connectionStateChange` / `[WebRTC] iceCandidate` / `[WebRTC] track` 이벤트가 정상 emit.

### 향후 변경 시 주의

- `AVAudioSession.sharedInstance()` 직접 통제 절대 금지 — `RTCAudioSession.sharedInstance()` 만 통제 (memory `project_call_audio_routing` 참조).
- `Package.swift` 변경 후 `npm run sync:ios` 사용 (cap sync 가 wipe 함).
- libwebrtc upgrade 시 stasel/WebRTC 새 release 의 PrivacyInfo.xcprivacy 변경 점검.
