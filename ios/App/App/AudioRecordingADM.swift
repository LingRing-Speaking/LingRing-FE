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
    fileprivate let queueKey = DispatchSpecificKey<String>()
    fileprivate let queueValue = "lingring.audio.recording.adm.queue"

    fileprivate var audioEngine: AVAudioEngine?
    fileprivate var audioSinkNode: AVAudioSinkNode?
    fileprivate var audioSourceNode: AVAudioSourceNode?
    fileprivate var audioEngineObserver: NSObjectProtocol?

    fileprivate var delegate_: RTCAudioDeviceDelegate?
    // 같은 큐 컨텍스트 안에서 호출 시 재진입 deadlock 회피 (queue.sync 중첩 호출이
    // libwebrtc worker thread 에서 EXC_BREAKPOINT 발생). dispatchSync 패턴과 동일.
    fileprivate var delegate: RTCAudioDeviceDelegate? {
        get {
            if DispatchQueue.getSpecific(key: queueKey) == queueValue {
                return delegate_
            }
            return queue.sync { delegate_ }
        }
        set {
            if DispatchQueue.getSpecific(key: queueKey) == queueValue {
                delegate_ = newValue
            } else {
                queue.sync { delegate_ = newValue }
            }
        }
    }

    fileprivate var shouldPlay = false
    fileprivate var shouldRecord = false
    fileprivate var isInterrupted = false

    fileprivate var inputFormat: AVAudioFormat?
    fileprivate var outputFormat: AVAudioFormat?

    override init() {
        super.init()
        queue.setSpecific(key: queueKey, value: queueValue)
    }
}

extension AudioRecordingADM {
    fileprivate func shutdownEngine() {
        guard let audioEngine = audioEngine else { return }
        if let observer = audioEngineObserver {
            NotificationCenter.default.removeObserver(observer)
            audioEngineObserver = nil
        }
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

    // BT 연결/해제 같은 HW 변경 시 sample rate 가 바뀌어도 AVAudioEngine 의 internal
    // sample rate 는 자동 따라가지 않음 → audio speed 깨짐 (느리게/빠르게 들림).
    // AVAudioEngineConfigurationChange notification 받아 engine 을 새 HW 포맷으로 재구성.
    @objc fileprivate func handleEngineConfigurationChange() {
        queue.async { [weak self] in
            guard let self = self else { return }
            NSLog("[AudioRecordingADM] engine configuration changed — restart")
            self.shutdownEngine()
            self.delegate_?.notifyAudioInputParametersChange()
            self.delegate_?.notifyAudioOutputParametersChange()
            self.updateEngine()
        }
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
        // BT 연결 등으로 HW sample rate 가 바뀌면 발화. engine 을 재구성해야 audio speed 정상.
        audioEngineObserver = NotificationCenter.default.addObserver(
            forName: .AVAudioEngineConfigurationChange,
            object: engine,
            queue: nil
        ) { [weak self] _ in
            self?.handleEngineConfigurationChange()
        }
        return engine
    }

    fileprivate func attachSinkNodeIfNeeded(engine: AVAudioEngine) {
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

        // libwebrtc 는 16-bit int interleaved mono PCM 을 받음.
        // HW 가 stereo 여도 SimpleAudioConverter 가 mixing.
        guard let rtcFormat = AVAudioFormat(commonFormat: .pcmFormatInt16,
                                             sampleRate: hwFormat.sampleRate,
                                             channels: 1,
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

    fileprivate func attachSourceNodeIfNeeded(engine: AVAudioEngine) {
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

        // libwebrtc playout 도 mono 로 통일 (input 과 일치).
        guard let rtcFormat = AVAudioFormat(commonFormat: .pcmFormatInt16,
                                             sampleRate: hwFormat.sampleRate,
                                             channels: 1,
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
}

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
        case .newDeviceAvailable, .oldDeviceUnavailable:
            // BT 헤드폰 같은 audio device 연결/해제 시 HW sample rate 가 바뀜.
            // VPIO 환경에서는 AVAudioEngineConfigurationChange 가 안 발화하는 경우 있어
            // route change 에서 직접 engine 재시작 트리거.
            queue.async { [weak self] in
                guard let self = self else { return }
                NSLog("[AudioRecordingADM] device route changed (\(reason.rawValue)) — restart engine")
                self.shutdownEngine()
                self.delegate_?.notifyAudioInputParametersChange()
                self.delegate_?.notifyAudioOutputParametersChange()
                self.updateEngine()
            }
        case .categoryChange, .routeConfigurationChange:
            // sample rate 안 바뀌는 미세 변경. engine 재시작 없이 notify 만.
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

extension AudioRecordingADM: RTCAudioDevice {
    // MARK: parameters
    var deviceInputSampleRate: Double { audioSession.sampleRate }
    var inputIOBufferDuration: TimeInterval { audioSession.ioBufferDuration }
    // libwebrtc 는 internal 로 mono 처리. HW 가 stereo 여도 mono 로 노출해야
    // AVAudioBuffer channel count mismatch (buffer=2 vs format=1) 회피.
    var inputNumberOfChannels: Int { 1 }
    var inputLatency: TimeInterval { audioSession.inputLatency }
    var deviceOutputSampleRate: Double { audioSession.sampleRate }
    var outputIOBufferDuration: TimeInterval { audioSession.ioBufferDuration }
    var outputNumberOfChannels: Int { 1 }
    var outputLatency: TimeInterval { audioSession.outputLatency }

    // MARK: state
    var isInitialized: Bool { delegate != nil }
    var isPlayoutInitialized: Bool { isInitialized }
    var isRecordingInitialized: Bool { isInitialized }
    var isPlaying: Bool { shouldPlay }
    var isRecording: Bool { shouldRecord }

    // MARK: lifecycle
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

    // MARK: thread control (RTCAudioDevice protocol)
    func dispatchAsync(_ block: @escaping () -> Void) {
        queue.async { block() }
    }

    func dispatchSync(_ block: @escaping () -> Void) {
        if DispatchQueue.getSpecific(key: queueKey) == queueValue {
            block()
        } else {
            queue.sync { block() }
        }
    }
}
