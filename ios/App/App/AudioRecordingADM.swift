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

    override init() {
        super.init()
        queue.setSpecific(key: queueKey, value: queueValue)
    }
}

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
