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

    // 녹음 write 경로 (Phase 2). 마이크 PCM 을 libwebrtc 로 deliver 하는 같은 sink block 에서
    // 파일에도 동시에 write. 통화 connected 시점에 start, end 시점에 stop.
    // file+converter+버퍼를 RecordingWriter 하나로 묶어 단일 참조로 교체 — 라우트 전환 시
    // converter 와 file 이 어긋난 조합으로 읽히는 것을 방지 (#184).
    fileprivate var recordingWriter: RecordingWriter?
    fileprivate var recordingFileURL: URL?

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

    // 엔진이 마지막으로 구성된 시점의 세션 rate/라우트. route change 가 실제 변화 없이
    // (엔진 재시작 자체가 발화시킨 .routeConfigurationChange 등) 도착했을 때 재시작을
    // 스킵하는 판정 기준 — 재시작→(8)→재시작 부메랑 루프 방지.
    fileprivate var lastAppliedRouteSignature: String?

    override init() {
        super.init()
        queue.setSpecific(key: queueKey, value: queueValue)
    }
}

extension AudioRecordingADM {
    // libwebrtc worker thread 에서 호출되는 getter 가 queue 소유 상태(inputFormat/outputFormat)를
    // 안전하게 읽기 위한 헬퍼. delegate 접근자와 같은 재진입 회피 패턴.
    fileprivate func syncRead<T>(_ read: () -> T) -> T {
        if DispatchQueue.getSpecific(key: queueKey) == queueValue {
            return read()
        }
        return queue.sync { read() }
    }

    // 현재 세션 rate + 입출력 포트 조합. lastAppliedRouteSignature 와 비교해
    // "재구성이 실제로 필요한 변화인가" 를 판정한다.
    fileprivate func currentRouteSignature() -> String {
        let route = audioSession.currentRoute
        let outs = route.outputs.map { $0.portType.rawValue }.joined(separator: "+")
        let ins = route.inputs.map { $0.portType.rawValue }.joined(separator: "+")
        return "\(audioSession.sampleRate)|\(outs)|\(ins)"
    }

    // #182 계측: 라우트/포맷 전환 시점에 "세션 rate vs 노드 rate" 일치 여부를 실기기 로그로 확인.
    fileprivate func logAudioState(_ tag: String) {
        let route = audioSession.currentRoute
        let outs = route.outputs.map { $0.portType.rawValue }.joined(separator: "+")
        let ins = route.inputs.map { $0.portType.rawValue }.joined(separator: "+")
        let (nodeIn, nodeOut) = syncRead { (inputFormat?.sampleRate ?? -1, outputFormat?.sampleRate ?? -1) }
        NSLog("[ADM-DIAG][\(tag)] session=\(audioSession.sampleRate)Hz out=\(outs) in=\(ins) nodeIn=\(nodeIn)Hz nodeOut=\(nodeOut)Hz")
    }

    fileprivate func shutdownEngine() {
        guard let audioEngine = audioEngine else { return }
        if let observer = audioEngineObserver {
            NotificationCenter.default.removeObserver(observer)
            audioEngineObserver = nil
        }
        if audioEngine.isRunning {
            audioEngine.stop()
        }
        // notify 계열은 계약상 dispatchAsync/dispatchSync 블록 안에서만 호출 가능 (RTCAudioDevice.h #182)
        if let sinkNode = audioSinkNode {
            audioEngine.detach(sinkNode)
            audioSinkNode = nil
            if let delegate = delegate_ {
                delegate.dispatchAsync { delegate.notifyAudioInputInterrupted() }
            }
        }
        if let sourceNode = audioSourceNode {
            audioEngine.detach(sourceNode)
            audioSourceNode = nil
            if let delegate = delegate_ {
                delegate.dispatchAsync { delegate.notifyAudioOutputInterrupted() }
            }
        }
        self.audioEngine = nil
    }

    // BT 연결/해제 같은 HW 변경 시 sample rate 가 바뀌어도 AVAudioEngine 의 internal
    // sample rate 는 자동 따라가지 않음 → audio speed 깨짐 (느리게/빠르게 들림).
    // AVAudioEngineConfigurationChange notification 받아 engine 을 새 HW 포맷으로 재구성.
    // 파라미터 notify 는 재구성 완료 후 updateEngine 끝에서 일괄 수행 (#182).
    @objc fileprivate func handleEngineConfigurationChange() {
        queue.async { [weak self] in
            guard let self = self else { return }
            self.logAudioState("engineConfigChange")
            NSLog("[AudioRecordingADM] engine configuration changed — restart")
            self.shutdownEngine()
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

        // 이 구성이 반영한 세션 rate/라우트를 기록 — 이후 동일 상태의 route change 는 스킵된다.
        lastAppliedRouteSignature = currentRouteSignature()

        // (재)구성이 끝난 뒤 최종 파라미터를 libwebrtc 에 전달. getter 가 노드 attach 포맷을
        // 반환하므로, 이 notify 가 곧 "실제 교환 rate" 의 동기화다. 계약상 notify 는 반드시
        // dispatchAsync/dispatchSync 블록 안에서 호출해야 한다 (RTCAudioDevice.h #182).
        if let delegate = delegate_ {
            delegate.dispatchAsync {
                delegate.notifyAudioInputParametersChange()
                delegate.notifyAudioOutputParametersChange()
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

        let sinkNode = AVAudioSinkNode { [weak self] (timestamp, framesCount, inputData) -> OSStatus in
            // 1) libwebrtc 로 deliver (통화 SRTP path)
            var flags: AudioUnitRenderActionFlags = []
            var renderContext = (Unmanaged.passUnretained(converter), inputData)
            let result = deliverRecordedData(&flags, timestamp, 1, framesCount, nil, &renderContext, customRenderBlock)

            // 2) 동시에 녹음 파일에 write (Phase 2). 활성 writer 있을 때만.
            //    writer 가 mic 포맷 → 파일 고정 포맷(24kHz mono) 변환을 담당하므로 라우트
            //    전환으로 hwFormat 이 바뀌어도 파일 write 가 끊기지 않는다 (#184).
            self?.recordingWriter?.write(inputData, frames: framesCount)

            return result
        }

        engine.attach(sinkNode)
        engine.connect(engine.inputNode, to: sinkNode, format: hwFormat)
        audioSinkNode = sinkNode
        // attach 성공 시에만 기록 — 이 값이 deviceInputSampleRate 로 보고되는 계약의 원천 (#182)
        inputFormat = rtcFormat
        logAudioState("sink attached")

        // 녹음 중 라우트 전환으로 mic 포맷이 바뀐 경우: 파일은 그대로 두고 converter 만
        // 새 포맷으로 교체. 교체 실패 시 기존 writer 로 계속 쓰면 포맷 불일치로 매 버퍼
        // 실패하므로 중단이 낫다 (#184).
        if let writer = recordingWriter, writer.micFormat != hwFormat {
            if let rebuilt = RecordingWriter(file: writer.file, micFormat: hwFormat) {
                recordingWriter = rebuilt
                NSLog("[AudioRecordingADM] recording converter rebuilt: mic=\(hwFormat.sampleRate)Hz")
            } else {
                recordingWriter = nil
                NSLog("[AudioRecordingADM] recording writer rebuild failed — recording stops (mic=\(hwFormat))")
            }
        }
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
        // attach 성공 시에만 기록 — 이 값이 deviceOutputSampleRate 로 보고되는 계약의 원천 (#182)
        outputFormat = rtcFormat
        logAudioState("source attached")
    }
}

extension AudioRecordingADM {
    // WebRTCPlugin.configureForCall 의 책임을 ADM 안으로 이전.
    // 이어피스 default + .voiceChat mode + iOS 17+ .allowBluetoothHFP 정책 보존.
    func configureAudioSessionForCall() throws {
        logAudioState("configureForCall:before")
        try audioSession.setCategory(
            .playAndRecord,
            mode: .voiceChat,
            options: bluetoothOptions()
        )
        try audioSession.setActive(true)
        logAudioState("configureForCall:after")
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
            // 라우트가 바뀌면 HW sample rate 가 바뀔 수 있다. BT 이어폰은 착탈뿐 아니라
            // configureForCall 의 카테고리 전환(A2DP→HFP 플립, reason=.categoryChange)으로도
            // rate 가 2~3배 바뀐다 — notify 만으로는 노드가 낡은 포맷에 남아 배속/저속이
            // 고착되므로 engine 을 재구성한다 (#182).
            // 단, 엔진 재구성 자체가 .routeConfigurationChange(8) 를 다시 발화시키므로
            // "실제 변화 없음"이면 스킵해야 한다 — 아니면 재시작→(8)→재시작 무한 루프로
            // 네이티브 WebRTC 호출(setLocalDescription 등)이 굶어 시그널링이 멈춘다.
            // VPIO 환경에서는 AVAudioEngineConfigurationChange 가 안 발화하는 경우 있어
            // route change 에서 직접 engine 재시작 트리거. notify 는 updateEngine 끝에서 일괄.
            queue.async { [weak self] in
                guard let self = self else { return }
                if self.audioEngine?.isRunning == true,
                   self.lastAppliedRouteSignature == self.currentRouteSignature() {
                    NSLog("[AudioRecordingADM] route changed (\(reason.rawValue)) — 실제 변화 없음, 재시작 스킵")
                    return
                }
                self.logAudioState("routeChange(\(reason.rawValue))")
                NSLog("[AudioRecordingADM] route changed (\(reason.rawValue)) — restart engine")
                self.shutdownEngine()
                self.updateEngine()
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
    // 계약 (RTCAudioDevice.h): 이 rate 는 deliverRecordedData/getPlayoutData 로 "실제 교환되는
    // PCM 의 rate" 여야 하며 libwebrtc 는 이 경계에서 리샘플링하지 않는다. 그래서 원천은
    // 라이브 audioSession.sampleRate(라우트 전환 중 노드와 어긋날 수 있음 — #182 배속/저속의
    // 근본 원인)가 아니라 노드 attach 시점 포맷이어야 한다. 세션 값은 엔진이 아직 없을 때의
    // 폴백 (mstyura AVAudioEngineRTCAudioDevice 와 동일 구조).
    var deviceInputSampleRate: Double {
        syncRead { inputFormat?.sampleRate } ?? audioSession.sampleRate
    }
    var inputIOBufferDuration: TimeInterval { audioSession.ioBufferDuration }
    // libwebrtc 는 internal 로 mono 처리. HW 가 stereo 여도 mono 로 노출해야
    // AVAudioBuffer channel count mismatch (buffer=2 vs format=1) 회피.
    var inputNumberOfChannels: Int { 1 }
    var inputLatency: TimeInterval { audioSession.inputLatency }
    var deviceOutputSampleRate: Double {
        syncRead { outputFormat?.sampleRate } ?? audioSession.sampleRate
    }
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

// MARK: - RecordingWriter (#184)

// 녹음 write 경로의 단일 소유 객체: 고정 포맷 파일 + mic 포맷→파일 포맷 converter + 재사용 출력 버퍼.
// sink block(IO thread)은 이 객체 하나만 읽으므로, 라우트 전환 시 참조 교체만으로 file/converter 가
// 항상 짝이 맞는다. AVAudioConverter 가 SRC(예: 48kHz→24kHz)와 스테레오→모노 다운믹스를 담당.
private final class RecordingWriter {
    let file: AVAudioFile
    let micFormat: AVAudioFormat
    private let converter: AVAudioConverter
    private let outputBuffer: AVAudioPCMBuffer
    private var didLogWriteFailure = false

    // IO 콜백당 최대 프레임(경험상 ≤4096)에 SRC 비율 여유를 더한 고정 용량 — 콜백 안 할당 회피.
    private static let maxFramesPerCallback: Double = 4096

    init?(file: AVAudioFile, micFormat: AVAudioFormat) {
        guard micFormat.sampleRate > 0,
              let converter = AVAudioConverter(from: micFormat, to: file.processingFormat) else {
            return nil
        }
        let ratio = file.processingFormat.sampleRate / micFormat.sampleRate
        let capacity = AVAudioFrameCount((Self.maxFramesPerCallback * max(1.0, ratio)).rounded(.up)) + 64
        guard let outputBuffer = AVAudioPCMBuffer(pcmFormat: file.processingFormat, frameCapacity: capacity) else {
            return nil
        }
        self.file = file
        self.micFormat = micFormat
        self.converter = converter
        self.outputBuffer = outputBuffer
    }

    // sink block(IO thread)에서 호출. 실패해도 통화를 막지 않도록 로그만 남긴다 (최초 1회).
    func write(_ inputData: UnsafePointer<AudioBufferList>, frames: AVAudioFrameCount) {
        guard let input = AVAudioPCMBuffer(pcmFormat: micFormat, bufferListNoCopy: inputData) else { return }
        input.frameLength = frames

        // pull 방식 스트리밍 변환. .endOfStream 은 SRC 필터 상태를 flush 해버리므로 쓰지 않고,
        // 콜백마다 입력 1개(.haveData) → 이후 .noDataNow. 변환 잔여 샘플은 converter 가 내부
        // 보관했다가 다음 콜백 출력에 포함하므로 유실이 없다.
        var fed = false
        var error: NSError?
        outputBuffer.frameLength = 0
        let status = converter.convert(to: outputBuffer, error: &error) { _, inputStatus in
            if fed {
                inputStatus.pointee = .noDataNow
                return nil
            }
            fed = true
            inputStatus.pointee = .haveData
            return input
        }
        guard status != .error else {
            logWriteFailureOnce("convert: \(error?.localizedDescription ?? "unknown")")
            return
        }
        guard outputBuffer.frameLength > 0 else { return } // SRC 지연으로 이번 콜백 출력 없음 — 정상

        do {
            try file.write(from: outputBuffer)
        } catch {
            logWriteFailureOnce("file.write: \(error.localizedDescription)")
        }
    }

    private func logWriteFailureOnce(_ message: String) {
        guard !didLogWriteFailure else { return }
        didLogWriteFailure = true
        NSLog("[AudioRecordingADM] recording write failed (이후 동일 오류 로그 생략): \(message)")
    }
}

// MARK: - Phase 2: file recording (JS bridge 용 public API)

extension AudioRecordingADM {
    // 녹음 파일 고정 sample rate. call-recording-design §7 스펙 (음성/STT 용도 충분).
    fileprivate static let recordingFileSampleRate: Double = 24000

    struct PendingRecording {
        let callId: Int64
        let filePath: String
        let sizeBytes: Int64
    }

    enum RecordingResult {
        struct Stopped {
            let filePath: String
            let sizeBytes: Int64
            let durationMs: Int64
        }
    }

    // 녹음 시작. 통화 connected 시점에 JS 가 호출.
    // - callId: BE 의 call entity id (파일명에 사용 + recovery 시 파싱)
    // - 같은 callId 의 파일이 이미 있으면 덮어씀 (이전 통화 잔재).
    func startFileRecording(callId: Int64) throws -> String {
        let directory = try Self.recordingsDirectory()
        let fileURL = directory.appendingPathComponent("\(callId).m4a")

        // engine 의 input 포맷 (sink node 가 연결된 포맷) 으로 파일 생성.
        //
        // ⚠️ Race 주의: JS 는 peer state="connected" 시점에 이 함수를 부르지만, libwebrtc 의
        // RTCAudioDeviceModule 이 startRecording (= updateEngine) 을 호출해 engine.start() 가
        // 끝나는 시점과 미세하게 어긋날 수 있다. 같은 LAN Wi-Fi 에서는 host candidate 로
        // P2P 직결되어 audio session 셋업이 connected 보다 빨라 race 가 거의 안 보이지만,
        // 셀룰러처럼 STUN/TURN 경유 환경에선 connected 가 먼저 도달해 engine 이 아직 안 켜진
        // 상태에서 이 함수가 호출되는 일이 재현된다. 따라서 짧게 polling 한다.
        let pollIntervalMs = 50
        let maxWaitMs = 1000
        var waitedMs = 0
        while !(audioEngine?.isRunning ?? false) {
            if waitedMs >= maxWaitMs {
                throw NSError(domain: "AudioRecordingADM", code: 1,
                              userInfo: [NSLocalizedDescriptionKey: "engine not running (timeout after \(maxWaitMs)ms)"])
            }
            Thread.sleep(forTimeInterval: Double(pollIntervalMs) / 1000.0)
            waitedMs += pollIntervalMs
        }
        // 파일 생성 + writer 설치는 queue 에서 — attach/rebuild(라우트 전환) 와 직렬화되어
        // "sink 는 새 포맷인데 writer 는 옛 포맷" 조합이 생기지 않는다 (#184).
        try queue.sync {
            guard let engine = audioEngine else {
                // polling 통과 후에도 nil 인 케이스 — 이론상 발생 안 함. 방어적 가드.
                throw NSError(domain: "AudioRecordingADM", code: 1,
                              userInfo: [NSLocalizedDescriptionKey: "engine became nil after wait"])
            }
            let hwFormat = engine.inputNode.outputFormat(forBus: 1)
            // .m4a 컨테이너 + AAC 인코딩. 파일 포맷은 라우트와 무관한 고정 스펙
            // (call-recording-design §7: 24kHz mono, 64kbps — 음성/STT 충분).
            // 라우트 전환으로 mic 포맷이 바뀌어도 파일은 불변, writer 의 converter 만 교체 (#184).
            let settings: [String: Any] = [
                AVFormatIDKey: kAudioFormatMPEG4AAC,
                AVSampleRateKey: Self.recordingFileSampleRate,
                AVNumberOfChannelsKey: 1,
                AVEncoderAudioQualityKey: AVAudioQuality.medium.rawValue,
                AVEncoderBitRateKey: 64000,
            ]
            let file = try AVAudioFile(forWriting: fileURL, settings: settings)
            guard let writer = RecordingWriter(file: file, micFormat: hwFormat) else {
                throw NSError(domain: "AudioRecordingADM", code: 2,
                              userInfo: [NSLocalizedDescriptionKey: "failed to create recording converter (mic=\(hwFormat))"])
            }
            self.recordingWriter = writer
            self.recordingFileURL = fileURL
        }

        NSLog("[AudioRecordingADM] file recording started: \(fileURL.lastPathComponent)")
        return fileURL.path
    }

    // 녹음 종료. cleanup 시 JS 가 호출. 파일 finalize + 메타 반환.
    //
    // ⚠️ AVAudioFile 의 m4a 컨테이너 finalize (moov atom 작성, AAC encoder flush) 는 deinit
    // 시점에 일어난다. 따라서 strong reference 가 살아있는 동안 attributesOfItem 으로 size 를
    // 재면 finalize 이전 값을 받게 되고, 그 값을 BE 의 presigned URL ContentLength 시그니처와
    // 비교하면 어긋나 S3 가 SignatureDoesNotMatch (HTTP 403) 로 거부한다.
    //
    // → file 의 모든 strong reference 가 release 된 *후* size 를 잰다. 구체적으로:
    //   1) closure scope 안에서 file 을 캡쳐해 duration 만 미리 계산
    //   2) closure 끝나는 순간 local `file` 변수 release → ARC deinit → finalize 완료
    //   3) closure return 후 size 를 읽으면 정확한 최종 byte 수
    func stopFileRecording() -> RecordingResult.Stopped? {
        let stopped: (URL, Int64)? = queue.sync {
            guard let url = self.recordingFileURL, let writer = self.recordingWriter else {
                return nil
            }
            let file = writer.file
            let durationMs = Int64(Double(file.length) / file.processingFormat.sampleRate * 1000)
            self.recordingWriter = nil
            self.recordingFileURL = nil
            return (url, durationMs)
            // closure 종료 → local `writer`/`file` 의 last strong reference 해제 → AVAudioFile
            // deinit → m4a moov atom 작성 + 파일 close.
        }
        guard let (url, durationMs) = stopped else { return nil }

        let attrs = (try? FileManager.default.attributesOfItem(atPath: url.path)) ?? [:]
        let size = (attrs[.size] as? NSNumber)?.int64Value ?? 0
        NSLog("[AudioRecordingADM] file recording stopped: \(url.lastPathComponent) size=\(size) durationMs=\(durationMs)")
        return RecordingResult.Stopped(filePath: url.path, sizeBytes: size, durationMs: durationMs)
    }

    // 앱 시작 시 recovery 가 호출. 잔여 파일 목록 반환.
    static func listPendingRecordings() throws -> [PendingRecording] {
        let directory = try recordingsDirectory()
        let entries = (try? FileManager.default.contentsOfDirectory(at: directory,
                                                                       includingPropertiesForKeys: [.fileSizeKey])) ?? []
        var pending: [PendingRecording] = []
        for url in entries where url.pathExtension == "m4a" {
            let base = url.deletingPathExtension().lastPathComponent
            guard let callId = Int64(base) else { continue }
            let size = ((try? FileManager.default.attributesOfItem(atPath: url.path))?[.size] as? NSNumber)?.int64Value ?? 0
            pending.append(PendingRecording(callId: callId, filePath: url.path, sizeBytes: size))
        }
        return pending
    }

    static func deleteRecordingFile(at path: String) throws {
        try FileManager.default.removeItem(atPath: path)
    }

    // 임시 폴더: Library/Caches/recordings/.
    // Caches 는 OS 가 디스크 부족 시 정리 가능. 우리는 업로드 성공 시 즉시 삭제하므로 OK.
    fileprivate static func recordingsDirectory() throws -> URL {
        let caches = try FileManager.default.url(for: .cachesDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
        let directory = caches.appendingPathComponent("recordings", isDirectory: true)
        if !FileManager.default.fileExists(atPath: directory.path) {
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        }
        return directory
    }
}
