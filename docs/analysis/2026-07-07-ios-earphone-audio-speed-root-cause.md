# iOS 이어폰 착용 시 통화 음성 배속/저속 — 근본 원인 분석

- 작성일: 2026-07-07
- 증상 보고: iOS에서 이어폰을 끼면 통화 목소리가 **배속 또는 저속**으로 들림. 이어폰을 빼면 즉시 정상.
- 분석 대상 코드: `ios/App/App/AudioRecordingADM.swift`, `ios/App/App/WebRTCPlugin.swift` (WebRTC 147.0.0, `ios/App/CapApp-SPM/Package.resolved`)
- 결론의 성격: **메커니즘은 코드·계약 문서 수준에서 확정** (아래 근거 전부 1차 소스 인용). 기기별 수치(HFP 협상 rate, 발화되는 notification 순서)만 §7의 계측 로그로 채우면 됨.

---

## 1. 한 줄 결론

**ADM이 libwebrtc에 보고하는 샘플레이트(`deviceInput/OutputSampleRate` = 라이브 `AVAudioSession.sampleRate`)와, AVAudioEngine 노드에 실제로 연결된 포맷의 샘플레이트(attach 시점 스냅샷)가 서로 다른 값으로 고착될 수 있는 구조**가 원인이다. libwebrtc는 이 경계에서 리샘플링을 하지 않고 보고된 rate를 그대로 신뢰하므로, 두 값이 어긋난 비율만큼 정확히 배속/저속으로 들린다. 내장 스피커/마이크만 쓰는 동안은 모든 시점의 rate가 48000으로 동일해 어긋날 수 없고, **이어폰(특히 Bluetooth)은 rate가 다른 라우트로의 전환을 만들기 때문에** 이어폰을 낀 상태에서만 증상이 나타난다.

## 2. iOS 통화 오디오 경로 (전제)

iOS 통화는 WebView WebRTC가 아니라 native libwebrtc + 커스텀 ADM 경로다 (#84 방안 3).

```
[상대방] ──SRTP──▶ libwebrtc ──getPlayoutData──▶ AVAudioSourceNode ─▶ mainMixer ─▶ outputNode ─▶ (수화기/이어폰)
[내 마이크] ─▶ inputNode ─▶ AVAudioSinkNode ──deliverRecordedData──▶ libwebrtc ──SRTP──▶ [상대방]
                                   └──▶ AVAudioFile (통화 녹음, Phase 2)
```

- ADM: `AudioRecordingADM` — `RTCPeerConnectionFactory(..., audioDevice:)`로 주입 (`WebRTCPlugin.swift:43-54`)
- 세션 구성(`configureForCall` → `.playAndRecord` + `.voiceChat` + `.allowBluetoothHFP`)은 JS가 `connectionStateChange === "connected"` 를 받은 **후에** 호출한다 (`useCallSession.ts:101-109` → `audioRoute.ts:10-13` → `WebRTCPlugin.swift:244-256`)

## 3. 계약 — libwebrtc가 ADM에 요구하는 불변식 (1차 소스)

아래는 전부 **실제 링크된 바이너리(WebRTC 147.0.0)의 `RTCAudioDevice.h`** 와 upstream `objc_audio_device*.mm` 원문이다.

**(C1) 보고 rate = 실제 교환 PCM의 rate.** libwebrtc는 `deviceInputSampleRate`/`deviceOutputSampleRate`로 `AudioParameters`를 만들고(`objc_audio_device.mm:26-46`), 그 rate 기준으로 10ms 단위 버퍼(FineAudioBuffer)를 구성한다(`:366,381`). `OnGetPlayoutData`/`OnDeliverRecordedData`는 **어떤 리샘플링도 하지 않고** 이 rate를 신뢰한 채 프레임을 채우고/소비한다(`:430-,503-`).

**(C2) rate 재독 시점은 3곳뿐.** ① `Init()` — 초기값은 델리게이트 상수 48000 (`objc_audio_device_delegate.mm:25-26`), ② `InitPlayout()/InitRecording()` (`objc_audio_device.mm:186-189, 281-284`), ③ `notifyAudio*ParametersChange` 수신 시 (`:550-570`). **그 사이에는 절대 다시 읽지 않는다.**

**(C3) notify는 반드시 dispatchAsync/dispatchSync 블록 안에서.** 헤더 원문: *"NOTE: Must be called within block executed via `dispatchAsync` or `dispatchSync`"* (`RTCAudioDevice.h:106-107, 117-118, 126-127, 135-136`). 델리게이트 구현은 스레드 홉 없이 `RTC_DCHECK_RUN_ON(impl_->thread())`로 검증만 한다(`objc_audio_device_delegate.mm:140-156`) — 릴리스 바이너리에선 DCHECK가 무효라 **잘못된 스레드에서 조용히 실행된다**.

**(C4) 설계 의도까지 명문화.** `dispatchSync` 주석: *"...to satisfy requirement that **native ADM audio parameters must be kept in sync with current audio parameters** before audio is actually played or recorded."* (`RTCAudioDevice.h:158-165`)

**(C5) `RTCAudioSession.useManualAudio`/`isAudioEnabled`는 커스텀 ADM에 효력이 없다.** `objc_audio_device.mm`·`objc_audio_device_delegate.mm` 어디에도 `RTCAudioSession` 참조가 없다. 즉 엔진 기동(`startPlayout`/`startRecording`) 시점은 libwebrtc 미디어 파이프라인이 결정하며, `AppDelegate.swift:14`의 `useManualAudio = true`와 `WebRTCPlugin.swift:248-251`의 `isAudioEnabled` 동기화는 이 ADM을 게이트하지 못한다.

또한 Apple SDK 헤더(iPhoneOS 26.4) 원문:

- `AVAudioSession.sampleRate` = **"The current hardware sample rate"** — 라우트에 따라 변하는 라이브 값 (`AVAudioSession.h:386-387`)
- `AVAudioEngineConfigurationChangeNotification`: HW 채널 수/샘플레이트 변경을 감지하면 *"the engine **stops itself** ... **The nodes remain attached and connected with previously set formats.** However, the app must reestablish connections if the connection formats need to change"* (`AVAudioEngine.h:871-896`) — **노드 포맷은 자동으로 새 HW를 따라가지 않는다**
- `.categoryChange`(=3)는 카테고리 변경으로 라우트가 바뀔 때의 reason (`AVAudioSessionTypes.h:399-401`)

## 4. 우리 구현이 계약을 깨는 지점

### V1 (근본 원인): 보고 rate의 원천이 잘못됨 — 노드 포맷이 아니라 라이브 세션 값

```swift
// AudioRecordingADM.swift:359, 365
var deviceInputSampleRate: Double { audioSession.sampleRate }
var deviceOutputSampleRate: Double { audioSession.sampleRate }
```

그런데 실제 PCM은 **attach 시점에 스냅샷한 포맷**으로 교환된다:

- 입력: `engine.inputNode.outputFormat(forBus: 1)` 기반 `rtcFormat`으로 sink 연결 (`:159-174, 211`) — `SimpleAudioConverter`는 float→int16/모노 변환만 하고 **리샘플링하지 않는다** (from/to가 같은 sampleRate로 생성됨, `:167-176`)
- 출력: `engine.outputNode.outputFormat(forBus: 0)` 기반 `rtcFormat`으로 `AVAudioSourceNode(format:)` 생성 (`:224-251`)

이 스냅샷을 저장하는 `inputFormat`/`outputFormat` 필드(`:49-50, 174, 239`)는 **대입만 있고 읽는 곳이 한 군데도 없다** (dead store). 즉 "실제 교환 rate"는 어디에도 보고되지 않고, libwebrtc는 "그 순간의 하드웨어 rate"(C1 위반)를 믿게 된다. 두 값이 다르면 그 비율만큼 속도가 틀어진다.

참조 구현(코드 주석이 명시한 패턴 원본, mstyura/RTCAudioDevice)은 정확히 반대로 되어 있다 — **getter가 노드에 연결한 포맷의 rate를 반환**하고, 세션 값은 엔진이 없을 때의 폴백일 뿐이다:

```swift
// mstyura AVAudioEngineRTCAudioDevice.swift:338-350
var deviceInputSampleRate: Double {
    guard let sampleRate = audioInputFormat?.sampleRate, sampleRate > 0 else {
        return audioSession.sampleRate   // 폴백
    }
    return sampleRate                    // ← 실제 노드 포맷의 rate
}
```

그리고 그 포맷 프로퍼티의 `didSet`에서만 notify를 쏜다(`:26-44`) — "실제 교환 rate가 바뀐 순간 = notify 순간"이라는 불변식이 **구조적으로** 보장된다.

### V2: `.categoryChange`/`.routeConfigurationChange`를 "rate 안 바뀌는 미세 변경"으로 오판

```swift
// AudioRecordingADM.swift:326-331
case .categoryChange, .routeConfigurationChange:
    // sample rate 안 바뀌는 미세 변경. engine 재시작 없이 notify 만.
```

이 전제는 통화 시작 시퀀스에서 정면으로 깨진다. C5에 의해 엔진은 `configureForCall` **이전**(libwebrtc 미디어 시작 시점)에 만들어질 수 있는데 — 이 어긋남은 코드 자신도 다른 곳에서 실측으로 기록해 놓았다(`startFileRecording`의 race 주석, `:471-476`) — BT 이어폰이 연결된 상태라면 `configureForCall`의 `setCategory(.playAndRecord, .voiceChat, .allowBluetoothHFP)`가 **A2DP(미디어용, 보통 44.1/48kHz) → HFP(통화용, 8~32kHz)** 라우트 플립을 일으키고, 그 reason이 바로 `.categoryChange`다(Apple 헤더 `:399-401`). 이때 핸들러는 notify만 하므로:

- libwebrtc가 믿는 rate ← 새 HFP rate로 갱신됨
- 노드 포맷 ← 옛 rate 그대로 (Apple 문서: 노드 포맷은 자동 갱신 안 됨)

→ **불일치가 만들어지고, 이후 라우트 이벤트가 없는 한 통화 내내 고착**된다. 복구는 `AVAudioEngineConfigurationChange` 발화 여부에 달렸는데, VPIO 환경에서 이 notification이 안 오는 경우가 있다는 것 역시 코드 자신의 주석이 실측으로 기록하고 있다(`:315-317`).

### V3: notify를 요구된 스레드 밖에서 직접 호출 — 재구성 경로도 원자적이지 않음

```swift
// AudioRecordingADM.swift:318-325 (handleEngineConfigurationChange 도 동일 패턴 :84-93)
queue.async { [weak self] in
    self.shutdownEngine()                              // notifyAudio*Interrupted 도 이 안에서 직접 호출 (:71,76)
    self.delegate_?.notifyAudioInputParametersChange()  // ← C3 위반: dispatchAsync/Sync 미경유
    self.delegate_?.notifyAudioOutputParametersChange()
    self.updateEngine()
}
```

- C3 위반: notify가 ADM 소유 스레드가 아니라 **우리 GCD 큐에서 실행** → `HandleAudio*ParametersChange`(파라미터·FineAudioBuffer 재구성)가 라이브 렌더 콜백과 경합.
- 더 중요한 구조 문제: **libwebrtc가 믿는 rate의 재독**(notify 시점의 `audioSession.sampleRate`)과 **노드 포맷의 재독**(updateEngine의 attach 시점)이 **서로 다른 순간에** 일어난다. 라우트 전환 과도기(BT 링크 재협상 중)에는 두 읽기가 서로 다른 값을 얻을 수 있고, attach 시점에는 notify를 다시 쏘지 않으므로(V1 — didSet 패턴 부재) 최종 상태가 불일치로 고착될 수 있다. `.newDeviceAvailable`(통화 중 이어폰 착용) 경로가 간헐적으로 깨지는 메커니즘이 이것이다.

참고: `.override`/`.unknown` reason 무시(`:311-313`)와 이어피스 기본 정책 자체는 문제가 아니다 (memory `project_call_audio_routing` 정책 준수).

## 5. 인과 사슬 — 증상과의 1:1 대응

속도비 공식 (경계에서 리샘플링이 없으므로, C1):

```
내가 듣는 상대 목소리 속도 = (출력 노드 포맷 rate) / (libwebrtc가 믿는 출력 rate)
상대가 듣는 내 목소리 속도 = (libwebrtc가 믿는 입력 rate) / (입력 노드 포맷 rate)
```

| 고착 상태 (출력 경로 예) | 발생 경로 | 청감 |
|---|---|---|
| 노드 48000 유지, 보고값만 HFP 24000으로 갱신 | V2 (notify-only) | **2.0× 배속** |
| 노드 48000 유지, 보고값 16000 | V2 (mSBC 협상 시) | **3.0× 배속** |
| 노드 24000 재부착, 보고값 48000(과도기 값) 고착 | V3 (재구성 race) | **0.5× 저속** |
| 입력 경로 대칭 케이스 | V2/V3 | 상대 쪽에서 배속/저속 |

- **"배속으로도, 저속으로도 들린다"** → 어느 read가 이기느냐에 따라 비율의 분자/분모가 바뀌는 위 구조와 정확히 일치.
- **"이어폰을 빼면 정상"** → `.oldDeviceUnavailable`은 전체 재구성 경로(`:314-325`)를 타고, 내장 라우트에서는 이후 **모든 시점의 읽기가 48000으로 동일**하므로 어떤 순서로 읽어도 일치 → 즉시 정상. (race가 존재해도 값이 같아 무해.)
- **"이어폰 없으면 애초에 정상"** → rate가 변하는 전환 자체가 없음 → 불일치가 만들어질 수 없음.
- 이어폰 중에서도 **Bluetooth(HFP)** 가 대표 케이스인 이유: 통화 라우트의 rate가 8~32kHz로 내장(48kHz)과 크게 달라 2~3배의 극적인 배속/저속이 남. 유선 이어폰은 보통 48kHz를 유지해 증상이 없거나 미세해야 하며, §7 계측으로 실사용 기기의 값을 확정한다.

### 대안 가설 배제 (점검 완료)

| 가설 | 배제 근거 |
|---|---|
| WebView `<audio>` 재생 문제 | iOS native 경로는 JS에 더미 `MediaStream`만 전달, 재생은 전부 ADM (`peerConnection.ts:146-152`) |
| 엔진 내부(노드↔믹서↔HW) SRC 오류 | 엔진은 자신이 아는 포맷 간 변환을 스스로 수행 (Apple 헤더 `:871-896` — output chain은 rate conversion 지원). 문제는 포맷 정보가 없는 **libwebrtc↔노드 경계**뿐 |
| `overrideOutputAudioPort(.speaker)` 간섭 | 증상은 스피커 토글과 무관하게 발생하며 `.override` reason은 무시됨 (`:309-313`) |
| 상대방(Android) 측 원인 | 내 기기의 이어폰 탈착이 즉시 청감을 바꿈 → 로컬 라우트 인과 |

## 6. 스파이크 QA(④ "BT 연결/해제 PASS")와 배치되지 않는 이유

설계 문서(`docs/superpowers/specs/2026-05-19-call-recording-design.md` §5 ④)의 검증은 **통화 중 착탈**(= 전체 재구성 경로, race라서 간헐 재현) 위주였다. 반면 **이어폰을 낀 채 통화를 시작**하는 흐름은 V0(엔진 선기동)+V2(notify-only) 조합이라 재현율이 높다 — 이 경로는 당시 시나리오 표에 없다.

## 7. 확정 계측 (기기 1대, 10분) — 남은 수치 채우기

메커니즘은 위로 확정이지만, "이 기기+이 이어폰에서 어떤 reason 순서와 어떤 rate가 실제로 기록되는가"는 로그로 박제한다. `AudioRecordingADM.swift`에 임시 로그:

```swift
private func logAudioState(_ tag: String) {
    let route = audioSession.currentRoute.outputs.map(\.portType.rawValue).joined(separator: "+")
        + "|in:" + audioSession.currentRoute.inputs.map(\.portType.rawValue).joined(separator: "+")
    NSLog("[ADM-DIAG][\(tag)] session=\(audioSession.sampleRate)Hz route=\(route) "
        + "nodeIn=\(inputFormat?.sampleRate ?? -1) nodeOut=\(outputFormat?.sampleRate ?? -1)")
}
```

호출 지점: ① sink/source attach 직후(`attachSinkNodeIfNeeded`/`attachSourceNodeIfNeeded` 끝), ② `handleRouteChange` 진입(+ `reason.rawValue`), ③ `handleEngineConfigurationChange` 진입, ④ `configureAudioSessionForCall` 직전/직후.

재현 3케이스와 판정:

| 케이스 | 조작 | 배속/저속 재현 시 기대 로그 |
|---|---|---|
| A | AirPods 낀 채 매칭→통화 시작 | ④ 직후 `session`이 48000→(8k~32k)로 점프, reason=3(categoryChange) 이후 **nodeOut ≠ session 인 채 로그가 멈춤** |
| B | 통화 중 AirPods 착용 | reason=1 이후 재구성 로그가 있어도 **최종 nodeOut ≠ 마지막 notify 시점 session** |
| C | 통화 중 AirPods 해제 | reason=2 이후 nodeOut=session=48000 수렴 (증상 소멸과 일치) |

`nodeIn/nodeOut ≠ session` 인 채 정지한 로그 = 본 문서 결론의 실기기 확증이다.

## 8. 수정 방향 (권장 순서)

원칙: **mstyura 불변식 채택** — "notify가 전달하는 rate"의 원천을 라이브 세션 값이 아니라 **노드에 실제 연결한 포맷**으로 바꾼다. 이것 하나로 어떤 이벤트 순서·타이밍에서도 속도 왜곡이 원리적으로 불가능해진다.

1. **getter 교체 (핵심, V1)** — 저장만 하고 안 쓰던 필드를 계약의 원천으로:
   ```swift
   var deviceInputSampleRate: Double { inputFormat?.sampleRate ?? audioSession.sampleRate }
   var deviceOutputSampleRate: Double { outputFormat?.sampleRate ?? audioSession.sampleRate }
   ```
2. **포맷 변화 시점에 notify (V1)** — `inputFormat`/`outputFormat`에 `didSet`(값 변화 시에만)으로 `delegate?.dispatchAsync { notify... }` 발화. attach가 곧 notify가 되어 재구성 후 최종 포맷이 반드시 전달된다.
3. **스레드 계약 준수 (V3)** — `handleRouteChange`/`handleEngineConfigurationChange`의 shutdown→재구성→notify 전체를 `delegate.dispatchAsync` 블록(= ADM 소유 스레드) 안으로 이동. `shutdownEngine` 내부의 `notifyAudio*Interrupted`도 동일. (mstyura가 `handleAudioEngineConfigurationChanged`에서 `delegate.dispatchAsync { updateEngine() }` 하나로 처리하는 구조 참고, `:326-333`)
4. **`.categoryChange`/`.routeConfigurationChange`도 재구성 경로로 통일 (V2)** — "미세 변경" 분기 삭제. 1·2가 적용되면 재구성 비용 외 부작용 없음. 추가로 mstyura의 신선도 체크(엔진 rate가 세션 native rate와 다르면 rebuild, `:127-130`)를 `updateEngine`에 넣으면 놓친 이벤트도 다음 기회에 자가 복구된다.
5. **회귀 검증**: §7 케이스 A/B/C + 무이어폰 통화 + 스피커 토글 + 인터럽션(전화 수신) + 녹음 파일 재생 속도. 로그로 `nodeIn=nodeOut=session` 항상 일치 확인.

## 9. 부수 발견 (본 증상과 별개, 이슈화 권장)

- **P1 · 통화 중 라우트 전환 시 녹음 뒷부분 유실 위험**: 녹음 파일은 시작 시점 HW 포맷으로 생성되는데(`:493-503`), 전환 후 재구성된 sink 블록은 **새 hwFormat 버퍼**를 같은 파일에 write한다(`:196-205`). `AVAudioFile.write(from:)`은 processingFormat 불일치 시 throw → 캐치되어 로그만 남고 이후 구간이 파일에 안 쓰인다. 통화 중 이어폰을 꼈다 뺀 녹음의 분석 품질 저하로 이어질 수 있음.
- **P2 · `useManualAudio`/`isAudioEnabled`는 이 ADM에 무효** (C5): `AppDelegate.swift:12-14`, `WebRTCPlugin.swift:243, 247-251, 270-273`의 주석·코드가 주는 "우리가 엔진 라이프사이클을 게이트한다"는 인상은 커스텀 ADM에선 사실이 아니다. 오해 방지를 위해 주석 정리 또는 제거 권장.
- **P3 · dead code**: `AudioRecordingADM.swift:431-442`의 `dispatchAsync/dispatchSync`는 `RTCAudioDevice` 프로토콜 멤버가 아니라 델리게이트(`RTCAudioDeviceDelegate`) 쪽 메서드라 libwebrtc가 호출하지 않는다. 삭제 가능.

## 10. 참고 자료

- 계약 헤더 (링크된 바이너리와 동일): [RTCAudioDevice.h](https://webrtc.googlesource.com/src/+/refs/heads/main/sdk/objc/components/audio/RTCAudioDevice.h) — 로컬 확인: `~/Library/Developer/Xcode/DerivedData/App-*/Build/Products/Debug-iphoneos/WebRTC.framework/Headers/RTCAudioDevice.h` (147.0.0)
- upstream ADM 구현: [objc_audio_device.mm](https://webrtc.googlesource.com/src/+/refs/heads/main/sdk/objc/native/src/objc_audio_device.mm) · [objc_audio_device_delegate.mm](https://webrtc.googlesource.com/src/+/refs/heads/main/sdk/objc/native/src/objc_audio_device_delegate.mm)
- 참조 구현 (WebRTC 헤더가 endorse): [mstyura/RTCAudioDevice — AVAudioEngineRTCAudioDevice.swift](https://github.com/mstyura/RTCAudioDevice/blob/main/CustomRTCAudioDevice/AVAudioEngineRTCAudioDevice.swift)
- Apple SDK 헤더 (iPhoneOS 26.4): `AVAudioEngine.h`(ConfigurationChange), `AVAudioSessionTypes.h`(RouteChangeReason), `AVAudioSession.h`(sampleRate)
- 선행 설계 문서: `docs/superpowers/specs/2026-05-19-call-recording-design.md` (#84 방안 3, ADM 채택 배경)
