# 통화 녹음 ADM Spike Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Custom `RTCAudioDevice` (ADM) 경로가 우리 `stasel/WebRTC 147` + `#84` audio routing 정책 위에서 동작하는지 1주 안에 정량 검증.

**Architecture:** `AudioRecordingADM` (Swift, `RTCAudioDevice` 구현)을 새로 작성하고 `WebRTCPlugin`의 `RTCPeerConnectionFactory init`에 주입. `AVAudioEngine` 기반 — `AVAudioSinkNode`로 mic PCM을 받아 libwebrtc에 deliver, `AVAudioSourceNode`로 libwebrtc playout PCM을 받아 스피커로 출력. **녹음 코드는 없음** — 통화 audio 동등성 검증만이 목적.

**Tech Stack:** Swift, `AVFoundation` (`AVAudioEngine`·`AVAudioSession`·`AVAudioSinkNode`·`AVAudioSourceNode`), stasel/WebRTC 147 (`RTCAudioDevice` protocol), Capacitor 8.

**Reference:**
- 스펙: `docs/superpowers/specs/2026-05-19-call-recording-design.md`
- 패턴 reference (copy 불가, 학습용): [`mstyura/RTCAudioDevice/CustomRTCAudioDevice/AVAudioEngineRTCAudioDevice.swift`](https://github.com/mstyura/RTCAudioDevice/blob/main/CustomRTCAudioDevice/AVAudioEngineRTCAudioDevice.swift) + `SimpleAudioConverter.swift` + `AudioSessionHandler.swift`
- 현재 코드: `ios/App/App/WebRTCPlugin.swift`
- 이전 결정 근거: `IOS_AUDIO_ROUTING_INVESTIGATION.md` · `IOS_AUDIO_ROUTING_REVISITED.md`

**범위 밖 (Spike에서 안 다룸)**:
- 녹음 (file write tap) — Phase 2
- 단위 테스트 — Native AVAudioEngine은 fake가 어려움. 실기기 검증으로 대체
- Web/Android — 별도 작업
- `useCallSession`·`CallPage`·JS 측 코드 — Spike에서 변경 없음 (JS는 ADM 존재를 모름)

**검증 게이트** (Task 14):
- 6/6 통과 → Phase 1 본격 진행
- 3~5/6 통과 → 1주 연장, 막힌 시나리오 디버그
- ≤2/6 통과 → STOP, SaaS/SFU 백업 옵션 진지 검토

---

## Task 1: Spike 브랜치 생성

**Files:**
- Branch: `spike/call-adm-replacement` (신규)

- [ ] **Step 1: 현재 브랜치 확인 + worktree에서 시작 권장**

```bash
git branch --show-current
# 현재 feat/#116-recording 이어야 정상 (브레인스토밍 결과 spec이 그 위에 commit 됨)
```

- [ ] **Step 2: 새 브랜치 생성 (worktree로 권장 — 격리)**

```bash
git fetch origin
git worktree add ../LingRing-FE-spike-adm -b spike/call-adm-replacement origin/dev
cd ../LingRing-FE-spike-adm
```

또는 worktree 안 쓸 경우:

```bash
git switch --no-track -c spike/call-adm-replacement origin/dev
```

- [ ] **Step 3: spec 문서를 spike 브랜치에도 복사 (편의)**

```bash
git cherry-pick 987e836
# spec 커밋 cherry-pick. 충돌 없으면 통과
```

Expected: `[spike/call-adm-replacement <new-hash>] docs(call): 통화 녹음 설계 spec 추가`

---

## Task 2: AudioRecordingADM 빈 스켈레톤

**Files:**
- Create: `ios/App/App/AudioRecordingADM.swift`

- [ ] **Step 1: 신규 파일 생성 — `RTCAudioDevice` protocol 빈 구현**

```swift
import Foundation
import WebRTC
import AVFoundation

// AVAudioEngine 기반 custom ADM. WebRTCPlugin 의 RTCPeerConnectionFactory init 에 주입.
// 본 Spike 단계는 통화 audio 동등성 검증만 — 녹음 코드 없음.
//
// 패턴 reference: mstyura/RTCAudioDevice (copy 불가, 학습용)
// 참고 문서: docs/superpowers/specs/2026-05-19-call-recording-design.md
final class AudioRecordingADM: NSObject {
    fileprivate let audioSession = AVAudioSession.sharedInstance()
    fileprivate let queue = DispatchQueue(label: "lingring.audio.recording.adm")

    fileprivate var audioEngine: AVAudioEngine?
    fileprivate var audioSinkNode: AVAudioSinkNode?
    fileprivate var audioSourceNode: AVAudioSourceNode?

    fileprivate var delegate_: RTCAudioDeviceDelegate?
    fileprivate var delegate: RTCAudioDeviceDelegate? {
        get { queue.sync { delegate_ } }
        set { queue.sync { delegate_ = newValue } }
    }

    fileprivate var shouldPlay = false
    fileprivate var shouldRecord = false
    fileprivate var isInterrupted = false

    fileprivate var inputFormat: AVAudioFormat?
    fileprivate var outputFormat: AVAudioFormat?
}

extension AudioRecordingADM: RTCAudioDevice {
    // MARK: parameters
    var deviceInputSampleRate: Double { audioSession.sampleRate }
    var inputIOBufferDuration: TimeInterval { audioSession.ioBufferDuration }
    var inputNumberOfChannels: Int { min(2, audioSession.inputNumberOfChannels) }
    var inputLatency: TimeInterval { audioSession.inputLatency }
    var deviceOutputSampleRate: Double { audioSession.sampleRate }
    var outputIOBufferDuration: TimeInterval { audioSession.ioBufferDuration }
    var outputNumberOfChannels: Int { min(2, audioSession.outputNumberOfChannels) }
    var outputLatency: TimeInterval { audioSession.outputLatency }

    // MARK: state
    var isInitialized: Bool { delegate != nil }
    var isPlayoutInitialized: Bool { isInitialized }
    var isRecordingInitialized: Bool { isInitialized }
    var isPlaying: Bool { shouldPlay }
    var isRecording: Bool { shouldRecord }

    // MARK: lifecycle (Task 9 에서 채움)
    func initialize(with delegate: RTCAudioDeviceDelegate) -> Bool {
        self.delegate = delegate
        return true
    }
    func terminateDevice() -> Bool {
        self.delegate = nil
        return true
    }
    func initializePlayout() -> Bool { true }
    func startPlayout() -> Bool { false }   // Task 9
    func stopPlayout() -> Bool { false }    // Task 9
    func initializeRecording() -> Bool { true }
    func startRecording() -> Bool { false } // Task 9
    func stopRecording() -> Bool { false }  // Task 9
}
```

- [ ] **Step 2: project.pbxproj에 파일 등록**

Xcode를 열어 `AudioRecordingADM.swift`를 `App` group에 추가:

```bash
open ios/App/App.xcodeproj
```

Xcode 좌측 navigator → `App` 폴더 우클릭 → "Add Files to App..." → `AudioRecordingADM.swift` 선택 → "Add". 

또는 직접 pbxproj 편집 — `WebRTCPlugin.swift` 등록 패턴과 동일하게 4곳 추가 (BuildFile / FileReference / Group / Sources phase). 패턴은 기존 pbxproj의 `WebRTCPlugin.swift` 등록 부분 grep으로 확인:

```bash
grep -n "WebRTCPlugin.swift" ios/App/App.xcodeproj/project.pbxproj
```

- [ ] **Step 3: 빌드 통과 확인**

```bash
npm run sync:ios
xcodebuild -workspace ios/App/App.xcodeproj/project.xcworkspace \
  -scheme App -configuration Debug \
  -destination 'generic/platform=iOS Simulator' \
  build 2>&1 | tail -20
```

또는 단순히 Xcode에서 ⌘B.

Expected: `BUILD SUCCEEDED`

- [ ] **Step 4: 커밋**

```bash
git add ios/App/App/AudioRecordingADM.swift ios/App/App.xcodeproj/project.pbxproj
git commit -m "feat(spike/adm): AudioRecordingADM 빈 스켈레톤 추가

RTCAudioDevice protocol 의 빈 구현. lifecycle 메서드는 후속 task 에서.
"
```

---

## Task 3: SimpleAudioConverter 헬퍼 포팅

**Files:**
- Create: `ios/App/App/SimpleAudioConverter.swift`

WebRTC는 16-bit interleaved PCM 을 받음. AVAudioEngine input/output은 보통 32-bit float. 사이 변환이 필요.

mstyura의 [`SimpleAudioConverter.swift`](https://github.com/mstyura/RTCAudioDevice/blob/main/CustomRTCAudioDevice/SimpleAudioConverter.swift)를 우리 환경에 맞게 포팅.

- [ ] **Step 1: 파일 생성**

```swift
import Foundation
import AVFoundation
import WebRTC

// HW PCM format (보통 32-bit float, non-interleaved) ↔ WebRTC PCM format (16-bit int, interleaved) 변환.
// mstyura/RTCAudioDevice/CustomRTCAudioDevice/SimpleAudioConverter.swift 패턴 포팅.
final class SimpleAudioConverter {
    private let converter: AVAudioConverter
    private let inputFormat: AVAudioFormat
    private let outputFormat: AVAudioFormat

    init?(from inputFormat: AVAudioFormat, to outputFormat: AVAudioFormat) {
        guard let converter = AVAudioConverter(from: inputFormat, to: outputFormat) else {
            return nil
        }
        self.converter = converter
        self.inputFormat = inputFormat
        self.outputFormat = outputFormat
    }

    func convert(framesCount: AVAudioFrameCount,
                 from inputData: UnsafePointer<AudioBufferList>,
                 to outputData: UnsafeMutablePointer<AudioBufferList>) -> OSStatus {
        guard let inputBuffer = AVAudioPCMBuffer(pcmFormat: inputFormat, bufferListNoCopy: inputData) else {
            return -1
        }
        inputBuffer.frameLength = framesCount

        guard let outputBuffer = AVAudioPCMBuffer(pcmFormat: outputFormat, bufferListNoCopy: outputData) else {
            return -1
        }
        outputBuffer.frameLength = framesCount

        var error: NSError?
        var consumed = false
        let inputBlock: AVAudioConverterInputBlock = { _, status in
            if consumed {
                status.pointee = .endOfStream
                return nil
            }
            consumed = true
            status.pointee = .haveData
            return inputBuffer
        }
        let result = converter.convert(to: outputBuffer, error: &error, withInputFrom: inputBlock)
        return (result == .error) ? -1 : noErr
    }
}
```

- [ ] **Step 2: pbxproj에 등록 + 빌드**

Task 2의 Step 2·3과 동일 패턴.

```bash
npm run sync:ios && xcodebuild -workspace ios/App/App.xcodeproj/project.xcworkspace \
  -scheme App -configuration Debug \
  -destination 'generic/platform=iOS Simulator' build 2>&1 | tail -5
```

Expected: `BUILD SUCCEEDED`

- [ ] **Step 3: 커밋**

```bash
git add ios/App/App/SimpleAudioConverter.swift ios/App/App.xcodeproj/project.pbxproj
git commit -m "feat(spike/adm): SimpleAudioConverter 헬퍼 추가

HW 32-bit float ↔ WebRTC 16-bit int PCM 변환.
"
```

---

## Task 4: AudioRecordingADM 의 AVAudioSession 통제

**Files:**
- Modify: `ios/App/App/AudioRecordingADM.swift`

현재 `WebRTCPlugin.configureForCall`이 하는 일을 ADM 안으로 이전. ADM이 audio session lifecycle 주체.

- [ ] **Step 1: AudioRecordingADM 에 audio session 통제 메서드 추가**

`AudioRecordingADM.swift`의 `extension AudioRecordingADM: RTCAudioDevice` 위에 추가:

```swift
extension AudioRecordingADM {
    // WebRTCPlugin.configureForCall 의 책임을 ADM 안으로 이전.
    // 이어피스 default + .voiceChat mode + iOS 17+ .allowBluetoothHFP 정책 보존.
    func configureAudioSessionForCall() throws {
        try audioSession.setCategory(
            .playAndRecord,
            mode: .voiceChat,
            options: bluetoothOptions()
        )
        try audioSession.setActive(true)
    }

    func deactivateAudioSession() throws {
        try audioSession.setActive(false, options: [.notifyOthersOnDeactivation])
    }

    func setSpeaker(on: Bool) throws {
        try audioSession.overrideOutputAudioPort(on ? .speaker : .none)
    }

    private func bluetoothOptions() -> AVAudioSession.CategoryOptions {
        if #available(iOS 17.0, *) {
            return [.allowBluetoothHFP]
        } else {
            return [.allowBluetooth]
        }
    }
}
```

- [ ] **Step 2: 빌드 통과 확인**

```bash
npm run sync:ios && xcodebuild -workspace ios/App/App.xcodeproj/project.xcworkspace \
  -scheme App -configuration Debug \
  -destination 'generic/platform=iOS Simulator' build 2>&1 | tail -5
```

Expected: `BUILD SUCCEEDED`

- [ ] **Step 3: 커밋**

```bash
git add ios/App/App/AudioRecordingADM.swift
git commit -m "feat(spike/adm): ADM 에 audio session 통제 메서드 추가

WebRTCPlugin.configureForCall 의 책임을 ADM 안으로 이전 준비.
이어피스 default + .voiceChat + iOS 17+ .allowBluetoothHFP 정책 보존.
"
```

---

## Task 5: AVAudioEngine 인스턴스 + updateEngine() 핵심 로직

**Files:**
- Modify: `ios/App/App/AudioRecordingADM.swift`

mstyura의 `updateEngine()` 패턴을 우리 환경에 적용. shouldPlay/shouldRecord/isInterrupted 플래그에 따라 engine을 동적으로 띄우고 내리고, sink/source node를 attach/detach.

- [ ] **Step 1: shutdownEngine + updateEngine 메서드 추가**

`AudioRecordingADM.swift`에 추가:

```swift
extension AudioRecordingADM {
    fileprivate func shutdownEngine() {
        guard let audioEngine = audioEngine else { return }
        if audioEngine.isRunning {
            audioEngine.stop()
        }
        if let sinkNode = audioSinkNode {
            audioEngine.detach(sinkNode)
            audioSinkNode = nil
            delegate?.notifyAudioInputInterrupted()
        }
        if let sourceNode = audioSourceNode {
            audioEngine.detach(sourceNode)
            audioSourceNode = nil
            delegate?.notifyAudioOutputInterrupted()
        }
        self.audioEngine = nil
    }

    // mstyura 패턴: shouldPlay/shouldRecord 플래그 변화 시마다 호출.
    // VPIO 사용 + sink/source node 연결.
    fileprivate func updateEngine() {
        guard delegate != nil,
              shouldPlay || shouldRecord,
              !isInterrupted else {
            shutdownEngine()
            return
        }

        let engine: AVAudioEngine = audioEngine ?? createEngine()
        audioEngine = engine

        let ioAudioUnit = engine.outputNode.auAudioUnit
        if ioAudioUnit.isInputEnabled != shouldRecord || ioAudioUnit.isOutputEnabled != shouldPlay {
            if engine.isRunning { engine.stop() }
            ioAudioUnit.isInputEnabled = shouldRecord
            ioAudioUnit.isOutputEnabled = shouldPlay
        }

        attachSinkNodeIfNeeded(engine: engine)
        attachSourceNodeIfNeeded(engine: engine)

        if !engine.isRunning {
            do {
                try engine.start()
            } catch {
                NSLog("[AudioRecordingADM] engine start failed: \(error)")
            }
        }
    }

    private func createEngine() -> AVAudioEngine {
        let engine = AVAudioEngine()
        engine.isAutoShutdownEnabled = true
        // outputNode 에서 voice processing 토글. inputNode 가 아닌 outputNode 에서 호출하는 게
        // mstyura 의 best practice (random crash 회피).
        if engine.outputNode.isVoiceProcessingEnabled != true {
            do {
                try engine.outputNode.setVoiceProcessingEnabled(true)
            } catch {
                NSLog("[AudioRecordingADM] setVoiceProcessingEnabled failed: \(error)")
            }
        }
        return engine
    }

    private func attachSinkNodeIfNeeded(engine: AVAudioEngine) {
        // Task 6 에서 채움 (sink node 부착)
    }

    private func attachSourceNodeIfNeeded(engine: AVAudioEngine) {
        // Task 7 에서 채움 (source node 부착)
    }
}
```

- [ ] **Step 2: 빌드 통과 확인**

```bash
npm run sync:ios && xcodebuild -workspace ios/App/App.xcodeproj/project.xcworkspace \
  -scheme App -configuration Debug \
  -destination 'generic/platform=iOS Simulator' build 2>&1 | tail -5
```

Expected: `BUILD SUCCEEDED` (`attachSinkNodeIfNeeded` 등이 빈 메서드라 warning 가능, error X)

- [ ] **Step 3: 커밋**

```bash
git add ios/App/App/AudioRecordingADM.swift
git commit -m "feat(spike/adm): updateEngine + shutdownEngine 로직 추가

VPIO 사용 AVAudioEngine 동적 lifecycle.
shouldPlay/shouldRecord/isInterrupted 플래그에 반응.
"
```

---

## Task 6: AVAudioSinkNode — mic input PCM → deliverRecordedData

**Files:**
- Modify: `ios/App/App/AudioRecordingADM.swift`

mic 마이크에서 PCM을 받아 libwebrtc에 deliver. `AVAudioSinkNode`의 receiverBlock에서 SimpleAudioConverter로 16-bit interleaved로 변환 후 `delegate.deliverRecordedData` 호출.

- [ ] **Step 1: attachSinkNodeIfNeeded 채우기**

`AudioRecordingADM.swift`의 `attachSinkNodeIfNeeded`를 다음으로 교체:

```swift
private func attachSinkNodeIfNeeded(engine: AVAudioEngine) {
    guard shouldRecord, audioSinkNode == nil, let delegate = delegate else {
        if !shouldRecord, let node = audioSinkNode {
            engine.detach(node)
            audioSinkNode = nil
        }
        return
    }

    let hwFormat = engine.inputNode.outputFormat(forBus: 1)
    guard hwFormat.sampleRate > 0, hwFormat.channelCount > 0 else {
        NSLog("[AudioRecordingADM] invalid input format: \(hwFormat)")
        return
    }

    // libwebrtc 는 16-bit int interleaved PCM 을 받음
    guard let rtcFormat = AVAudioFormat(commonFormat: .pcmFormatInt16,
                                         sampleRate: hwFormat.sampleRate,
                                         channels: hwFormat.channelCount,
                                         interleaved: true) else {
        NSLog("[AudioRecordingADM] failed to create rtcFormat")
        return
    }
    inputFormat = rtcFormat

    guard let converter = SimpleAudioConverter(from: hwFormat, to: rtcFormat) else {
        NSLog("[AudioRecordingADM] failed to create converter")
        return
    }

    let deliverRecordedData = delegate.deliverRecordedData
    let customRenderBlock: RTCAudioDeviceRenderRecordedDataBlock = { actionFlags, timestamp, inputBusNumber, frameCount, abl, renderContext in
        let context = renderContext!.assumingMemoryBound(
            to: (Unmanaged<SimpleAudioConverter>, UnsafeMutablePointer<AudioBufferList>).self
        ).pointee
        return context.0.takeUnretainedValue().convert(framesCount: frameCount, from: context.1, to: abl)
    }

    let sinkNode = AVAudioSinkNode { (timestamp, framesCount, inputData) -> OSStatus in
        var flags: AudioUnitRenderActionFlags = []
        var renderContext = (Unmanaged.passUnretained(converter), inputData)
        return deliverRecordedData(&flags, timestamp, 1, framesCount, nil, &renderContext, customRenderBlock)
    }

    engine.attach(sinkNode)
    engine.connect(engine.inputNode, to: sinkNode, format: hwFormat)
    audioSinkNode = sinkNode
}
```

- [ ] **Step 2: 빌드 통과 확인**

```bash
npm run sync:ios && xcodebuild -workspace ios/App/App.xcodeproj/project.xcworkspace \
  -scheme App -configuration Debug \
  -destination 'generic/platform=iOS Simulator' build 2>&1 | tail -10
```

Expected: `BUILD SUCCEEDED`

- [ ] **Step 3: 커밋**

```bash
git add ios/App/App/AudioRecordingADM.swift
git commit -m "feat(spike/adm): AVAudioSinkNode 로 mic PCM → deliverRecordedData

HW 포맷 → 16-bit interleaved 변환 후 libwebrtc 에 전달.
"
```

---

## Task 7: AVAudioSourceNode — getPlayoutData → speaker

**Files:**
- Modify: `ios/App/App/AudioRecordingADM.swift`

libwebrtc가 보내는 playout PCM을 받아 스피커로 출력. `AVAudioSourceNode`의 renderBlock에서 `delegate.getPlayoutData` 호출.

- [ ] **Step 1: attachSourceNodeIfNeeded 채우기**

```swift
private func attachSourceNodeIfNeeded(engine: AVAudioEngine) {
    guard shouldPlay, audioSourceNode == nil, let delegate = delegate else {
        if !shouldPlay, let node = audioSourceNode {
            engine.detach(node)
            audioSourceNode = nil
        }
        return
    }

    let hwFormat = engine.outputNode.outputFormat(forBus: 0)
    guard hwFormat.sampleRate > 0, hwFormat.channelCount > 0 else {
        NSLog("[AudioRecordingADM] invalid output format: \(hwFormat)")
        return
    }

    engine.connect(engine.mainMixerNode, to: engine.outputNode, format: hwFormat)

    guard let rtcFormat = AVAudioFormat(commonFormat: .pcmFormatInt16,
                                         sampleRate: hwFormat.sampleRate,
                                         channels: hwFormat.channelCount,
                                         interleaved: true) else {
        return
    }
    outputFormat = rtcFormat

    let getPlayoutData = delegate.getPlayoutData
    let sourceNode = AVAudioSourceNode(format: rtcFormat) { (isSilence, timestamp, frameCount, outputData) -> OSStatus in
        var flags: AudioUnitRenderActionFlags = []
        let result = getPlayoutData(&flags, timestamp, 0, frameCount, outputData)
        guard result == noErr else { return result }
        isSilence.initialize(to: ObjCBool(flags.contains(.unitRenderAction_OutputIsSilence)))
        return noErr
    }

    engine.attach(sourceNode)
    engine.connect(sourceNode, to: engine.mainMixerNode, format: rtcFormat)
    audioSourceNode = sourceNode
}
```

- [ ] **Step 2: 빌드 통과 확인**

```bash
npm run sync:ios && xcodebuild -workspace ios/App/App.xcodeproj/project.xcworkspace \
  -scheme App -configuration Debug \
  -destination 'generic/platform=iOS Simulator' build 2>&1 | tail -5
```

Expected: `BUILD SUCCEEDED`

- [ ] **Step 3: 커밋**

```bash
git add ios/App/App/AudioRecordingADM.swift
git commit -m "feat(spike/adm): AVAudioSourceNode 로 playout → speaker

libwebrtc playout PCM 을 받아 스피커에 출력.
"
```

---

## Task 8: Route change + Interruption observer (boomerang 차단)

**Files:**
- Modify: `ios/App/App/AudioRecordingADM.swift`

#84의 핵심 교훈 적용. `.override` reason 은 self-trigger 이므로 무시. BT 연결·해제, 전화 수신 같은 외부 이벤트만 ADM 에 notify.

- [ ] **Step 1: observer 메서드 추가**

```swift
extension AudioRecordingADM {
    fileprivate func registerObservers() {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleRouteChange(_:)),
            name: AVAudioSession.routeChangeNotification,
            object: nil
        )
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleInterruption(_:)),
            name: AVAudioSession.interruptionNotification,
            object: nil
        )
    }

    fileprivate func unregisterObservers() {
        NotificationCenter.default.removeObserver(self)
    }

    @objc private func handleRouteChange(_ notification: Notification) {
        guard let reasonValue = notification.userInfo?[AVAudioSessionRouteChangeReasonKey] as? UInt,
              let reason = AVAudioSession.RouteChangeReason(rawValue: reasonValue) else { return }

        // #84 교훈: .override 는 우리가 setSpeaker 호출해서 발생한 self-trigger.
        // boomerang loop 방지를 위해 무시.
        switch reason {
        case .override, .unknown:
            return
        case .newDeviceAvailable, .oldDeviceUnavailable, .categoryChange, .routeConfigurationChange:
            delegate?.dispatchAsync { [weak self] in
                self?.delegate?.notifyAudioInputParametersChange()
                self?.delegate?.notifyAudioOutputParametersChange()
            }
        default:
            return
        }
    }

    @objc private func handleInterruption(_ notification: Notification) {
        guard let typeValue = notification.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
              let type = AVAudioSession.InterruptionType(rawValue: typeValue) else { return }

        switch type {
        case .began:
            isInterrupted = true
            delegate?.dispatchAsync { [weak self] in
                self?.delegate?.notifyAudioInputInterrupted()
                self?.delegate?.notifyAudioOutputInterrupted()
            }
        case .ended:
            isInterrupted = false
            queue.async { [weak self] in self?.updateEngine() }
        @unknown default:
            return
        }
    }
}
```

- [ ] **Step 2: 빌드 통과 확인**

```bash
npm run sync:ios && xcodebuild -workspace ios/App/App.xcodeproj/project.xcworkspace \
  -scheme App -configuration Debug \
  -destination 'generic/platform=iOS Simulator' build 2>&1 | tail -5
```

Expected: `BUILD SUCCEEDED`

- [ ] **Step 3: 커밋**

```bash
git add ios/App/App/AudioRecordingADM.swift
git commit -m "feat(spike/adm): route change + interruption observer

#84 교훈 적용: .override reason 무시로 boomerang 차단.
BT/외부 device 변경·interruption 만 delegate 에 notify.
"
```

---

## Task 9: ADM lifecycle 메서드 채우기

**Files:**
- Modify: `ios/App/App/AudioRecordingADM.swift`

Task 2에서 빈 return으로 둔 `startRecording`/`stopRecording`/`startPlayout`/`stopPlayout` 등을 채움.

- [ ] **Step 1: lifecycle 메서드 교체**

`extension AudioRecordingADM: RTCAudioDevice` 의 lifecycle 메서드를 다음으로 교체:

```swift
func initialize(with delegate: RTCAudioDeviceDelegate) -> Bool {
    self.delegate = delegate
    registerObservers()
    return true
}

func terminateDevice() -> Bool {
    queue.sync {
        shouldPlay = false
        shouldRecord = false
        shutdownEngine()
    }
    unregisterObservers()
    self.delegate = nil
    return true
}

func initializePlayout() -> Bool { true }

func startPlayout() -> Bool {
    queue.sync {
        shouldPlay = true
        updateEngine()
    }
    return true
}

func stopPlayout() -> Bool {
    queue.sync {
        shouldPlay = false
        updateEngine()
    }
    return true
}

func initializeRecording() -> Bool { true }

func startRecording() -> Bool {
    queue.sync {
        shouldRecord = true
        updateEngine()
    }
    return true
}

func stopRecording() -> Bool {
    queue.sync {
        shouldRecord = false
        updateEngine()
    }
    return true
}
```

- [ ] **Step 2: `dispatchAsync` / `dispatchSync` 구현 추가**

protocol이 요구하는 두 메서드:

```swift
// RTCAudioDevice protocol 의 thread 통제 메서드
func dispatchAsync(_ block: @escaping () -> Void) {
    queue.async { block() }
}

func dispatchSync(_ block: @escaping () -> Void) {
    if DispatchQueue.getSpecific(forKey: queueKey) == queueValue {
        block()
    } else {
        queue.sync { block() }
    }
}
```

dispatchSync 의 reentrancy 처리를 위해 queue specific 등록:

`AudioRecordingADM` 클래스 안에 추가:

```swift
private let queueKey = DispatchSpecificKey<String>()
private let queueValue = "lingring.audio.recording.adm.queue"

override init() {
    super.init()
    queue.setSpecific(key: queueKey, value: queueValue)
}
```

- [ ] **Step 3: 빌드 통과 확인**

```bash
npm run sync:ios && xcodebuild -workspace ios/App/App.xcodeproj/project.xcworkspace \
  -scheme App -configuration Debug \
  -destination 'generic/platform=iOS Simulator' build 2>&1 | tail -5
```

Expected: `BUILD SUCCEEDED`

- [ ] **Step 4: 커밋**

```bash
git add ios/App/App/AudioRecordingADM.swift
git commit -m "feat(spike/adm): lifecycle 메서드 + dispatchAsync/Sync 구현

initialize/terminate/startRecording/stopRecording/startPlayout/stopPlayout 채움.
RTCAudioDevice protocol 요구사항 완성.
"
```

---

## Task 10: WebRTCPlugin 에 ADM 주입

**Files:**
- Modify: `ios/App/App/WebRTCPlugin.swift`

`RTCPeerConnectionFactory init` 을 `audioDevice:` overload 로 변경. 우리 ADM 인스턴스 주입.

- [ ] **Step 1: factory 정의 변경**

현재 코드 (`ios/App/App/WebRTCPlugin.swift:36-41`):

```swift
private static let factory: RTCPeerConnectionFactory = {
    RTCInitializeSSL()
    let encoderFactory = RTCDefaultVideoEncoderFactory()
    let decoderFactory = RTCDefaultVideoDecoderFactory()
    return RTCPeerConnectionFactory(encoderFactory: encoderFactory, decoderFactory: decoderFactory)
}()
```

다음으로 교체:

```swift
// ADM 인스턴스는 factory 와 같은 lifetime (앱 lifecycle).
fileprivate static let audioDevice = AudioRecordingADM()

private static let factory: RTCPeerConnectionFactory = {
    RTCInitializeSSL()
    let encoderFactory = RTCDefaultVideoEncoderFactory()
    let decoderFactory = RTCDefaultVideoDecoderFactory()
    return RTCPeerConnectionFactory(
        encoderFactory: encoderFactory,
        decoderFactory: decoderFactory,
        audioDevice: audioDevice
    )
}()
```

- [ ] **Step 2: 빌드 통과 확인**

```bash
npm run sync:ios && xcodebuild -workspace ios/App/App.xcodeproj/project.xcworkspace \
  -scheme App -configuration Debug \
  -destination 'generic/platform=iOS Simulator' build 2>&1 | tail -5
```

Expected: `BUILD SUCCEEDED`

- [ ] **Step 3: 커밋**

```bash
git add ios/App/App/WebRTCPlugin.swift
git commit -m "feat(spike/adm): WebRTCPlugin factory 에 AudioRecordingADM 주입

RTCPeerConnectionFactory init 을 audioDevice: overload 로 변경.
ADM 이 audio engine lifecycle 통제 주체.
"
```

---

## Task 11: configureForCall · setSpeaker · endCall 책임 ADM 위임

**Files:**
- Modify: `ios/App/App/WebRTCPlugin.swift`

기존 `configureForCall` / `setSpeaker` / `endCall` 의 audio session 조작 코드를 ADM 메서드 호출로 위임. 외부 JS API 시그니처는 보존 — JS 측 변경 없음.

- [ ] **Step 1: configureForCall 교체**

현재 코드 (`WebRTCPlugin.swift:231-250`)를 다음으로 교체:

```swift
@objc func configureForCall(_ call: CAPPluginCall) {
    do {
        try WebRTCPlugin.audioDevice.configureAudioSessionForCall()
        // RTCAudioSession 도 동기화 — ADM 외부 코드 (libwebrtc 내부 일부 동작) 에서 참조
        let session = RTCAudioSession.sharedInstance()
        session.lockForConfiguration()
        session.isAudioEnabled = true
        session.unlockForConfiguration()
        call.resolve()
    } catch {
        call.reject(error.localizedDescription)
    }
}
```

- [ ] **Step 2: setSpeaker 교체**

현재 코드 (`WebRTCPlugin.swift:252-263`)를 다음으로 교체:

```swift
@objc func setSpeaker(_ call: CAPPluginCall) {
    let on = call.getBool("on") ?? false
    do {
        try WebRTCPlugin.audioDevice.setSpeaker(on: on)
        call.resolve()
    } catch {
        call.reject(error.localizedDescription)
    }
}
```

- [ ] **Step 3: endCall 교체**

현재 코드 (`WebRTCPlugin.swift:265-276`)를 다음으로 교체:

```swift
@objc func endCall(_ call: CAPPluginCall) {
    do {
        let session = RTCAudioSession.sharedInstance()
        session.lockForConfiguration()
        session.isAudioEnabled = false
        session.unlockForConfiguration()
        try WebRTCPlugin.audioDevice.deactivateAudioSession()
        call.resolve()
    } catch {
        call.reject(error.localizedDescription)
    }
}
```

- [ ] **Step 4: 빌드 통과 확인**

```bash
npm run sync:ios && xcodebuild -workspace ios/App/App.xcodeproj/project.xcworkspace \
  -scheme App -configuration Debug \
  -destination 'generic/platform=iOS Simulator' build 2>&1 | tail -5
```

Expected: `BUILD SUCCEEDED`

- [ ] **Step 5: 커밋**

```bash
git add ios/App/App/WebRTCPlugin.swift
git commit -m "feat(spike/adm): configureForCall/setSpeaker/endCall 책임 ADM 위임

audio session 직접 조작을 ADM 메서드 호출로 이전.
JS API 시그니처 보존 (외부 동작 변경 없음).
"
```

---

## Task 12: 시뮬레이터 smoke test

**Files:** (none — 실행만)

ADM 코드가 들어간 빌드가 시뮬레이터에서 적어도 통화 connecting 단계까지는 진입하는지 smoke test. 시뮬레이터는 마이크가 없어 실제 통화는 제한적이지만, audio session 초기화 실패·crash 같은 큰 문제는 시뮬레이터에서 잡힘.

- [ ] **Step 1: 시뮬레이터 부팅 + 앱 실행**

```bash
npm run dev:ios
# 또는
npm run sync:ios
open ios/App/App.xcodeproj
# Xcode 에서 iPhone 16 Pro 시뮬레이터 선택 후 ⌘R
```

- [ ] **Step 2: 통화 진입 시도 + 로그 관찰**

dev 로그인 → 매칭 → 통화 화면 진입. Xcode console 또는 `Console.app` 에서 다음 확인:

- ❌ `AudioSession::beginInterruption but session is already interrupted!` 경고가 나오면 STOP — ADM lifecycle 문제
- ❌ crash 발생하면 STOP — stack trace 캡처
- ✅ `[WebRTC] connectionStateChange` 이벤트가 정상 emit
- ✅ `[AudioRecordingADM] engine start failed` 같은 우리 NSLog 가 없음

(시뮬레이터에서는 마이크 없어 통화 audio 자체는 검증 못 함. 실기기 검증은 Task 14 에서.)

- [ ] **Step 3: 결과 기록**

문제 없으면 다음 task. 문제 있으면 stack trace + 로그 캡처해서 spec 의 §11(결정 로그) 또는 새 섹션 `## 12. Spike 결과`에 기록.

- [ ] **Step 4: (변경 없으면) 커밋 스킵**

이 task 는 실행만 — 커밋할 코드 없음.

---

## Task 13: 실기기 빌드 준비

**Files:** (none — 실기기 배포)

실기기에서만 잡히는 audio routing 동작 검증을 위해 배포.

- [ ] **Step 1: 실기기 연결 + 개발자 인증 확인**

```bash
xcrun devicectl list devices 2>&1 | head -10
```

Expected: 연결된 iOS device 목록 표시.

- [ ] **Step 2: 실기기 빌드 + 설치**

Xcode 에서 실기기 destination 선택 후 ⌘R. 또는:

```bash
xcodebuild -workspace ios/App/App.xcodeproj/project.xcworkspace \
  -scheme App -configuration Debug \
  -destination 'generic/platform=iOS' \
  build 2>&1 | tail -10
```

Expected: `BUILD SUCCEEDED` + 실기기에 앱 설치.

- [ ] **Step 3: 통화 진입까지 동작 확인**

실기기에서 dev 로그인 → 매칭 → 통화 화면. 적어도 통화가 시작되는지 확인. 다음 task 의 정량 검증은 별도.

---

## Task 14: 실기기 6개 시나리오 검증 + 게이트 평가

**Files:**
- Modify: `docs/superpowers/specs/2026-05-19-call-recording-design.md` — Spike 결과 섹션 추가

spec 의 §5 검증 체크리스트 6개를 실기기에서 정확히 실행. 결과를 정량 기록 후 게이트 평가.

- [ ] **Step 1: 6개 시나리오 실행**

두 디바이스(또는 시뮬레이터 + 디바이스)로 통화 후 다음을 순서대로:

| # | 시나리오 | 통과 기준 |
|---|---|---|
| ① | 통화 진입 (BT 미연결) | outputs = `["Receiver"]`, 이어피스에서 음성 들림 |
| ② | `setSpeaker(off)` 6회 | 모두 정상 토글, audio 끊김 없음 — **방안 2가 죽었던 정확한 지점** |
| ③ | `setSpeaker(on)` 6회 | 모두 정상 토글 |
| ④ | BT 헤드셋 연결/해제 | 자동 라우팅, ADM 정상 reinit |
| ⑤ | 통화 중 전화 수신 interruption | 통화 audio 정상 복귀 |
| ⑥ | 로그 검증 | `AudioSession::beginInterruption but session is already interrupted!` 경고 없음 |

각 시나리오마다 PASS/FAIL + 비고를 기록.

- [ ] **Step 2: spec 에 Spike 결과 섹션 추가**

`docs/superpowers/specs/2026-05-19-call-recording-design.md` 끝에 추가:

```markdown
## 12. Spike 결과 (2026-MM-DD)

### 시나리오 결과

| # | 시나리오 | 결과 | 비고 |
|---|---|---|---|
| ① | 통화 진입 outputs | ✅/❌ | ... |
| ② | setSpeaker(off) 6회 | ✅/❌ | ... |
| ③ | setSpeaker(on) 6회 | ✅/❌ | ... |
| ④ | BT 연결/해제 | ✅/❌ | ... |
| ⑤ | interruption 복귀 | ✅/❌ | ... |
| ⑥ | 로그 경고 | ✅/❌ | ... |

총: N/6 통과

### 게이트 평가

- 6/6 통과 → Phase 1 본격 진행
- 3~5/6 통과 → 1주 연장, 막힌 시나리오 디버그
- ≤2/6 통과 → STOP, SaaS/SFU 백업 옵션 진지 검토

### 결정

[N/6 결과에 따라 다음 행동 명시]
```

- [ ] **Step 3: 커밋**

```bash
git add docs/superpowers/specs/2026-05-19-call-recording-design.md
git commit -m "docs(call): Spike 결과 기록 + 게이트 평가

실기기 6개 시나리오 검증 결과 + 다음 단계 결정.
"
```

- [ ] **Step 4: 다음 단계 결정 보고**

사용자에게 결과 보고:
- 6/6 → "Phase 1 plan 작성 시작" 제안
- 3~5/6 → "막힌 시나리오 분석 + 1주 연장 여부" 결정 요청
- ≤2/6 → "STOP. SaaS/SFU 옵션으로 큰 결정 다시" 권고

---

## Spec 커버리지 셀프 체크

- ✅ §1 요구사항 (자기 마이크 PCM → 파일·업로드) — Spike는 PCM 흐름 검증까지. 파일·업로드는 Phase 2
- ✅ §2 막힌 경로 표 (ADM이 유일 경로) — Spike가 정확히 이 가설 검증
- ✅ §3 채택 경로 — `RTCAudioDevice` protocol implement (Task 2·9)
- ✅ §4 진행 방식 (Spike → Phase 1 → Phase 2) — 본 plan은 Spike 단독
- ✅ §5 Spike 범위 — 본 plan에 1:1 매핑
- ✅ §5 검증 시나리오 6개 — Task 14에 그대로
- ✅ §8 백업 옵션 — Task 14 게이트가 ≤2/6 시 트리거
- ✅ #84 audio routing 정책 보존 (이어피스 default · `.voiceChat` · `.allowBluetoothHFP` · boomerang 차단) — Task 4·8
- ✅ Niche 영역 인지 — mstyura 패턴 학습 + 직접 작성 (Task 2~9)

## 알려진 한계

- 단위 테스트 부재 — Native AVAudioEngine은 fake가 거의 불가. 실기기 검증으로 대체 (Task 14)
- mstyura 코드 직접 copy 불가하나 패턴은 충실 따름 — 우리 환경(stasel/WebRTC 147 · #84 정책 · iOS 17+ `.allowBluetoothHFP`)에 맞게 직접 작성
- Spike 통과 후 Phase 1·2 plan은 별도 작성 — Spike 결과에 따라 범위 조정될 수 있음
