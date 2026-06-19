# iOS 통화 audio routing 문제 조사 (#84)

작성일: 2026-05-06
관련 이슈: [#84 — fix: 스피커폰 동작 안 함](https://github.com/LingRing-Speaking/LingRing-FE/issues/84)
브랜치 (작업 시): `fix/#84-speakerphone-toggle` → `feat/#84-callkit` → `feat/#84-iosrtc-native-webrtc` (모두 미머지)
stash 보관:
- `stash@{0}` (가장 최근) — `cordova-plugin-iosrtc-capacitor` 시도
- `stash@{1}` — CallKit spike
- `stash@{2}` — #84 직접 시도 (5+ 패턴)

---

## TL;DR

**WKWebView WebRTC + 외부 `AVAudioSession` API 조작은 architectural limitation**으로 우리 환경에서 자동 이어피스 라우팅 + 스피커 토글 양방향 + audio 안정 세 가지를 동시에 만족시킬 수 없다. 단순 fix로 해결 불가능한 fundamental 문제.

**근본 원인** (flutter-webrtc#1098 인사이트로 확정):
- Google WebRTC SDK 의 `RTCAudioSession` 클래스가 RTC audio engine 과 audio session 의 동기화를 담당.
- WKWebView WebRTC 는 이 클래스에 외부 접근을 차단 → 외부에서 `AVAudioSession.setActive(true)` / `overrideOutputAudioPort(...)` 같은 직접 조작이 RTC engine 과 race 를 만듦.
- CallKit (시스템 차원 통화 처리) 도 같은 layer 에서 동기화 시도하지만, WKWebView WebRTC 는 CallKit 의 audio session 활성화도 인식 못 함.

**진짜 해결**은 native WebRTC SDK 도입 (Google libwebrtc) 인데, 우리 시도 시점 (Capacitor 8 SPM 모드)에서 호환 plugin (`cordova-plugin-iosrtc-capacitor`) 의 번들 WebRTC.framework 가 너무 노후 (M69 / 2018) + Apple Silicon simulator 슬라이스 부재 + SPM 자동 link 미지원으로 도입 불가.

**실용 결론**: 단기적으로는 정책 양보(이어피스 자동 시작 포기, 토글 동작만 보장)가 현실적. 장기적으로는 (1) Capacitor → CocoaPods 모드 전환, (2) 직접 Google WebRTC SDK + 자체 plugin 작성, 또는 (3) WKWebView 자체를 우회하는 native WebRTC + WebView hybrid 로 architecture 변경 검토 필요.

---

## 환경

- LingRing-FE: React + TypeScript + Vite + Capacitor 8 (iOS SPM 모드)
- iOS deployment target: 15.0
- WebRTC: WKWebView 자체 구현 (`navigator.mediaDevices.getUserMedia` + `RTCPeerConnection`)
- 통화: 1:1 음성, peer-to-peer (`stun.l.google.com:19302`), 시그널링 BE
- 핵심 코드:
  - `src/domains/call/webrtc/peerConnection.ts` — `RTCPeerConnection` 래퍼
  - `src/domains/call/hooks/useCallSession.ts` — 통화 라이프사이클
  - `src/lib/native/audioRoute.ts` — Capacitor plugin JS 래퍼

---

## 시도 매트릭스

직접 시도 (`AudioRoutePlugin` 활용):

| # | mode | setActive 위치 | 첫 outputs | 토글 OFF | audio 안정 | 비고 |
|---|---|---|---|---|---|---|
| 1 | `.voiceChat` | 없음 | Speaker | ❌ override 무효 | ✓ | 첫 진입 정책 위반 |
| 2 | `.voiceChat` | `setSpeaker(off)` 만 | Speaker | ✓ | ✓ (대부분, 가끔 끊김) | 이어피스 자동 X |
| 3 | `.voiceChat` | `activate` + `setSpeaker(off)` | Receiver ✓ | ✓ | ❌ 마이크 안 됨 | race 결정적 |
| 4 | `.default` | 없음 | Speaker | ❌ | ✓ | mode 변경도 효과 X |
| 5 | `.voiceChat` | (옵저버 자동 보정) | Receiver → Speaker boomerang | — | ❌ | 옵저버가 self-trigger loop |

advanced spike:

| # | 접근 | outputs | audio | 비고 |
|---|---|---|---|---|
| 6 | **CallKit** | Receiver ✓ (자동) | ❌ | WebKit RTC engine 이 CallKit audio session 인식 못 함, `AudioSession::beginInterruption but session is already interrupted!` |
| 7 | **cordova-plugin-iosrtc-capacitor** | — | — | 빌드 실패 (Capacitor SPM 모드 호환 + WebRTC.framework M69 노후) |

---

## 시도별 상세

### 1. `AudioRoutePlugin` 직접 시도 (5+ 패턴)

#### 발견 1: Plugin UNIMPLEMENTED 문제 (이전부터 있던 진짜 첫 원인)

`AudioRoutePlugin.swift` 가 codebase 에 있었지만 실제 호출이 모두 `{"code":"UNIMPLEMENTED"}` 로 떨어지고 있었다. 사용자가 처음 보고한 "토글 안 먹음" 의 진짜 원인이 이것.

**원인**: Capacitor 6+ SPM 모드에서 main app target 의 in-app plugin 은 ObjC runtime 자동 발견이 안 됨. `CAPBridgeViewController` 를 그대로 storyboard 에 꽂는 default 셋업으로는 등록 X.

**해결 패턴** (Capacitor 6+ 표준):
1. `MainViewController.swift` 새로 작성 (`CAPBridgeViewController` 서브클래스)
2. `capacitorDidLoad()` 에서 `bridge?.registerPluginInstance(AudioRoutePlugin())` 명시 호출
3. `Main.storyboard` root viewController `customClass` 를 `MainViewController` (App 모듈) 로 교체
4. `project.pbxproj` 에 `MainViewController.swift` 등록 4곳 (BuildFile / FileReference / Group / Sources phase)

**참고**: ionic-team/capacitor#7443

#### 발견 2: `.allowBluetooth` deprecation (iOS 17+)

iOS 17 부터 `AVAudioSession.CategoryOptions.allowBluetooth` 가 deprecated, `.allowBluetoothHFP` 로 대체. Xcode 26 (iOS 18+ SDK) 에서 deprecation 경고 명시화. 사용자가 본 빌드 경고가 정확히 이것. iOS 17+ 에서는 routing 동작 자체도 일부 변화 보고.

**해결**: `if #available(iOS 17.0, *)` 분기로 `.allowBluetoothHFP` / `.allowBluetooth` 선택.

```swift
let options: AVAudioSession.CategoryOptions
if #available(iOS 17.0, *) {
    options = [.allowBluetoothHFP]
} else {
    options = [.allowBluetooth]
}
```

deprecation warning silence 시도 (`@available(iOS, deprecated: 17.0)` helper) 는 컴파일러 버전에 따라 silence 안 되는 케이스 있음 (Xcode 26). 빌드는 통과.

**참고**: [Swift Forums Xcode 26 thread](https://forums.swift.org/t/xcode-26-avaudiosession-categoryoptions-allowbluetooth-deprecated/80956)

#### 핵심 관찰: outputs (라우팅 메타데이터) vs 실제 audio output 분리

**실측 검증된 사실**: `session.currentRoute.outputs` 가 `["Receiver"]` 로 변경됐는데도 사용자는 여전히 스피커로 들리는 케이스 발견.

→ 즉 우리가 카테고리/override 로 변경하는 것은 **메타데이터 layer** 만 영향. 실제 **audio engine layer** 는 WebKit RTC 가 별도로 관리. 두 layer 가 분리되어 있고 우리 외부 API 로는 audio engine 동기화 불가능.

이게 architectural limitation 의 핵심 증거.

#### `setActive(true)` 호출의 부작용

| `setActive(true)` 호출 시점 | 결과 |
|---|---|
| AppDelegate didFinishLaunching | RTC startup 과 race → audio capture/playback 시작 안 됨 |
| `peer.start()` 직후 | 동일 race |
| `onConnected` 시점 | 잠깐 race + audio 일부 끊김 |
| 사용자 토글 OFF 시점 | 라우팅은 변환되지만 가끔 마이크 끊김 보고 |
| 옵저버 자동 보정 시점 | 가장 심각, boomerang loop |

**결론**: WebKit RTC engine 이 active 상태일 때 외부 `setActive(true)` 호출은 항상 race 위험. `setActive` 호출 자체를 회피해야 audio 안정. 그러나 `mode .voiceChat` 의 default 라우팅 (시스템 default = Speaker) 을 receiver 로 override 하려면 setActive 동반이 필요. **딜레마**.

### 2. CallKit Spike (가설 절반 적중)

CallKit 이 audio session lifecycle 을 시스템 차원에서 관리하면 외부 setActive 호출 race 회피 가능 가설로 시도.

**구현**:
- `CallKitPlugin.swift` (in-app Capacitor plugin)
- `CXProvider` + `CXCallController`, delegate
- `provider(_:didActivate:)` 에서 카테고리만 강제 (setActive 없이)
- `Info.plist` `UIBackgroundModes` 에 `voip` 추가

**결과 (실측 데이터)**:

```
[CallKit] startCall OK uuid=...
[CallKit] perform CXStartCallAction
[CallKit] didActivate — category=AVAudioSessionCategoryPlayAndRecord mode=AVAudioSessionModeVoiceChat outputs=["Receiver"]
WebContent[...] AudioSession::beginInterruption but session is already interrupted!
```

- ✓ `outputs=["Receiver"]` 자동 설정됨 (직접 시도들에서 모두 실패한 자동 이어피스 라우팅 성공)
- ✓ `category` / `mode` 가 자동으로 우리 의도와 일치
- ✗ **WebKit RTC engine 이 audio session 인식 못 함 → audio capture/playback 시작 안 됨** (마이크 + 스피커 양방향 무음)
- 시그널: `AudioSession::beginInterruption but session is already interrupted!` — WebKit RTC 가 audio session 활성화를 자체 interruption 처리 시도하다 충돌

**해석**: CallKit 은 metadata layer (라우팅 메타데이터, audio session activation) 까지 정확히 셋업하지만, **WebKit RTC engine layer 와의 동기화는 외부 framework 으로 불가능**. flutter-webrtc#1098 의 인사이트 — `RTCAudioSession` 이 있어야 RTC engine 과 동기화 — 가 정확히 적중.

### 3. cordova-plugin-iosrtc-capacitor (도입 실패)

native Google WebRTC iOS SDK + Capacitor 호환 fork. 이론적으로 `RTCAudioSession` 통제 + `cordova.plugins.iosrtc.turnOnSpeaker(true/false)` 자체 API 제공 → 가장 근본 해결.

**시도**: `npm install cordova-plugin-iosrtc-capacitor` + `npx cap sync ios` + `registerGlobals()` 호출.

**빌드 실패**:

```
Cannot find type 'RTCPeerConnectionFactory' in scope
Cannot find 'RTCInitializeSSL' in scope
Cannot find 'RTCDefaultVideoEncoderFactory' in scope
... (총 9개 컴파일 에러)
```

**원인 분석**:

1. **Capacitor SPM 모드의 cordova plugin 호환 layer 한계** — `capacitor-cordova-ios-plugins/sources/CordovaPluginIosrtcCapacitor/Package.swift` 가 cap CLI 자동 생성됐지만, plugin.xml 의 `<framework src="lib/WebRTC.framework"/>` 같은 framework 의존성을 SPM target 의 `linkerSettings` / `binaryTarget` 으로 변환 누락.

2. **WebRTC.framework 노후** — `file lib/WebRTC.framework/WebRTC` 결과:
   ```
   Mach-O universal binary with 4 architectures: [x86_64] [i386] [arm_v7] [arm64]
   ```
   - WebRTC M69 (2018, 7년 전)
   - i386 / armv7 deprecated 아키텍처 포함 (Xcode 15+ 에서 경고)
   - **arm64 simulator slice 없음** — Apple Silicon Mac 시뮬레이터 빌드 자체 불가능

3. **SPM 의 `.framework` 직접 link 미지원** — `.binaryTarget` 은 `.xcframework` 만 지원. 노후 `.framework` → `.xcframework` 변환 + Package.swift 수동 patch 필요. 그러나 cap sync 마다 Package.swift 자동 overwrite 되어 patch-package 같은 영구 patching 필요. 노력 대비 효과 의문.

4. **Plugin 자체 maintenance 약함** — npm 마지막 업데이트 시점·issue tracker 활동도 활발치 않음.

**결론**: 우리 환경 (Capacitor 8 SPM 모드 + iOS 18 deployment) 에서 이 plugin 도입 사실상 불가능.

---

## 미시도 옵션 (검토만)

### A. Capacitor → CocoaPods 모드 전환 + 동일 plugin 재시도

**장점**: cordova plugin 호환은 CocoaPods 가 원조 안정적. plugin.xml 의 framework 의존성을 자동 처리.

**단점**:
- `Podfile` 부활, `xcworkspace` 사용
- 기존 SPM 의존성 (`capacitor-swift-pm`, `@capacitor-community/apple-sign-in`, `@capacitor/preferences`, `@capacitor/splash-screen`, `capacitor-kakao-login-plugin`) 을 모두 CocoaPods 로 변환
- 큰 변화 + memory 의 "iOS 는 Capacitor 8 SPM 모드" 정책 변경
- 그래도 WebRTC.framework M69 노후 문제는 그대로

### B. 직접 Google WebRTC iOS SDK 통합 + 자체 Capacitor plugin

[Google WebRTC iOS](https://webrtc.googlesource.com/src/) 또는 fork (`pixiv/webrtc`, `stasel/WebRTC`) 의 최신 빌드를 SPM/CocoaPods 로 도입 후 자체 in-app plugin 작성.

**장점**: 최신 WebRTC + 정확한 통제 + RTCAudioSession 사용 가능.

**단점**:
- 매우 큰 작업 (2주+)
- `peerConnection.ts` 전체 재작성 (W3C API → native API 호출)
- Capacitor SPM 호환 검증 필요
- IPA 크기 증가 (libwebrtc 10-15MB)

### C. CallKit 재도입 + native SDK 조합

native SDK 가 도입되면 `RTCAudioSession` 사용 가능 → CallKit 의 audio session 활성화와 정상 동기화 가능. 시스템 통화 UI + 잠금 화면 통화 표시 + 백그라운드 audio session 우선순위 모두 해결.

단 (B) 가 선행되어야.

### D. PushKit + VoIP push (별도 작업)

백그라운드/종료 상태 incoming call. 이 PR 범위 밖 후속 작업.

### E. WKWebView 자체 우회 — UI 만 WKWebView, 통화는 native

WebRTC 부분만 native ViewController 로 분리. 통화 화면은 native UI + WebRTC SDK. 매칭/통화 외 UI 는 그대로 WKWebView. 큰 architecture 변경.

---

## 향후 작업 시 우선 검토할 것

이 문서를 읽고 다시 시도하는 사람이 가장 먼저 봐야 할 것:

1. **`flutter-webrtc#1098`** — 핵심 인사이트 (RTCAudioSession 와 AVAudioSession 의 차이)
2. **WKWebView WebRTC 가 audio engine layer 까지 통제하는 architecture** — outputs metadata 변경만으로 실제 audio output 안 바뀌는 사실 (이 문서 §1 핵심 관찰 참조)
3. **CallKit 단독으로는 해결 안 됨** — §2 spike 결과
4. **Capacitor SPM 모드 + WebRTC framework 호환성** — `.xcframework` 만 SPM `binaryTarget` 지원이라는 제약
5. **stash 들 참조** — `git stash list` 로 7+ 시도 코드 그대로 추출 가능 (`git stash show -p stash@{N}` 로 patch 보기)

**가장 promising 한 다음 시도 후보**:
- (B) 직접 native WebRTC SDK 통합 + 자체 plugin (가장 큰 작업이지만 가장 robust)
- (E) UI만 WKWebView, 통화는 native (architectural pivot)

**시도하지 말 것** (이미 검증된 막힘):
- AudioRoutePlugin 의 setCategory + setActive 조합으로 직접 라우팅 (5+ 패턴 모두 race)
- CallKit 단독 도입 (audio engine 동기화 불가)
- cordova-plugin-iosrtc-capacitor 그대로 도입 (Capacitor SPM + WebRTC.framework 노후 호환 X)

---

## 참고 자료

### Architectural 인사이트
- [flutter-webrtc#1098 — Can't switch speaker/earpiece on iOS](https://github.com/flutter-webrtc/flutter-webrtc/issues/1098) — **핵심**: RTCAudioSession 가 RTC engine 과 audio session 동기화의 핵심
- [ionic-team/capacitor#8176 — WebRTC not working properly on iOS Capacitor](https://github.com/ionic-team/capacitor/issues/8176) — WKWebView cold start audio session race
- [ionic-team/capacitor#7179 — iOS Capacitor cannot select Bluetooth output and input](https://github.com/ionic-team/capacitor/issues/7179)
- [ionic-team/capacitor#5401 — iOS Capacitor phone app cannot select audio output](https://github.com/ionic-team/capacitor/discussions/5401)
- [dotnet/macios#18078 — WKWebView + WebRTC + CallKit audio session conflict](https://github.com/dotnet/macios/issues/18078)
- [react-native-webrtc#1438 — WebRTC changes audio session category on iOS](https://github.com/react-native-webrtc/react-native-webrtc/issues/1438)

### Capacitor in-app plugin 등록
- [ionic-team/capacitor#7443 — Local plugins as "not implemented" after Capacitor 6](https://github.com/ionic-team/capacitor/issues/7443)
- [Capacitor Custom Native iOS Code Documentation](https://capacitorjs.com/docs/ios/custom-code)

### iOS audio session API
- [allowBluetoothHFP — Apple Developer Documentation](https://developer.apple.com/documentation/avfaudio/avaudiosession/categoryoptions-swift.struct/allowbluetoothhfp)
- [Xcode 26: AVAudioSession.CategoryOptions.allowBluetooth deprecated — Swift Forums](https://forums.swift.org/t/xcode-26-avaudiosession-categoryoptions-allowbluetooth-deprecated/80956)
- [Apple CallKit Documentation](https://developer.apple.com/documentation/callkit)
- [Mastering VoIP Audio with CallKit and WebRTC on iOS — Medium](https://medium.com/@tsivilko/mastering-voip-audio-with-callkit-and-webrtc-on-ios-0f2092402331)

### Native WebRTC integration 후보
- [cordova-rtc/cordova-plugin-iosrtc](https://github.com/cordova-rtc/cordova-plugin-iosrtc) — 본가 (Cordova)
- [cordova-plugin-iosrtc-capacitor (npm)](https://www.npmjs.com/package/cordova-plugin-iosrtc-capacitor) — Capacitor fork (이번 시도, 실패)
- [OpenTelecom/WKWebViewRTC](https://github.com/OpenTelecom/WKWebViewRTC) — Swift 네이티브 wrapper
- [stasel/WebRTC](https://github.com/stasel/WebRTC) — Google libwebrtc 의 SPM 호환 fork (잠재 후보)

---

## 부록: stash 들에서 코드 추출

```bash
# 모든 stash 보기
git stash list

# 특정 stash 의 변경 내용을 patch 로 보기
git stash show -p stash@{0}    # cordova plugin 시도
git stash show -p stash@{1}    # CallKit spike
git stash show -p stash@{2}    # 직접 시도 (5+ 패턴)

# 특정 stash 를 별도 브랜치로 복원
git stash branch archive/ios-audio-callkit stash@{1}
```

stash 는 `git gc` 시 사라질 수 있으니 장기 보존 필요하면 archive 브랜치로 옮기거나 patch 파일을 `docs/` 에 첨부 권장.
