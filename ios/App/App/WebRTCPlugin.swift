import Foundation
import Capacitor
import WebRTC

// 1:1 음성 통화용 native libwebrtc Capacitor plugin.
// JS 측 src/lib/native/webrtcPlugin.ts 의 registerPlugin("WebRTC") 와 매핑.
//
// 도입 배경: WKWebView WebRTC 의 audio engine state machine 을 외부 framework 으로 통제 불가능
// (#84 방안 1, 2 시도 후 architectural 한계 확정). 방안 3 = native libwebrtc + RTCAudioSession 직접
// 통제로 toggle 안정성 + 이어피스 default 정책 모두 만족.
//
// 설계:
// - RTCPeerConnectionFactory 1회 lazy init (앱 lifecycle 공유)
// - peerConnections dictionary 로 peerId 별 RTCPeerConnection 관리 (현재 1:1 이지만 ID-based for safety)
// - delegate 는 PluginPeerConnectionDelegate 별도 class — Notification 기반 emit
// - audio routing 은 Phase 2 의 configureForCall/setSpeaker/endCall 에서 RTCAudioSession 통제
@objc(WebRTCPlugin)
public class WebRTCPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "WebRTCPlugin"
    public let jsName = "WebRTC"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "createPeerConnection", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "createOffer", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "createAnswer", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setLocalDescription", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setRemoteDescription", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "addIceCandidate", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setMicEnabled", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "close", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "configureForCall", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setSpeaker", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "endCall", returnType: CAPPluginReturnPromise),
        // Phase 2: 녹음 파일 관리
        CAPPluginMethod(name: "startFileRecording", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopFileRecording", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "listPendingRecordings", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "deleteRecordingFile", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "uploadRecordingFile", returnType: CAPPluginReturnPromise),
    ]

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

    private struct PeerContext {
        let peerConnection: RTCPeerConnection
        let delegate: PluginPeerConnectionDelegate
        var localAudioTrack: RTCAudioTrack?
    }

    private var peers: [String: PeerContext] = [:]
    private let peersLock = NSLock()

    // MARK: - lifecycle

    @objc func createPeerConnection(_ call: CAPPluginCall) {
        guard let peerId = call.getString("peerId") else {
            call.reject("peerId is required"); return
        }
        let iceServersInput = call.getArray("iceServers", JSObject.self) ?? []
        let iceServers: [RTCIceServer] = iceServersInput.compactMap { entry in
            if let urls = entry["urls"] as? [String] {
                return RTCIceServer(urlStrings: urls)
            }
            if let url = entry["urls"] as? String {
                return RTCIceServer(urlStrings: [url])
            }
            return nil
        }

        let config = RTCConfiguration()
        config.iceServers = iceServers
        config.sdpSemantics = .unifiedPlan
        config.continualGatheringPolicy = .gatherContinually

        let constraints = RTCMediaConstraints(
            mandatoryConstraints: nil,
            optionalConstraints: ["DtlsSrtpKeyAgreement": "true"]
        )

        let delegate = PluginPeerConnectionDelegate(peerId: peerId) { [weak self] event, payload in
            self?.notifyListeners(event, data: payload)
        }

        guard let pc = WebRTCPlugin.factory.peerConnection(
            with: config,
            constraints: constraints,
            delegate: delegate
        ) else {
            call.reject("failed to create RTCPeerConnection"); return
        }

        peersLock.lock()
        peers[peerId] = PeerContext(peerConnection: pc, delegate: delegate, localAudioTrack: nil)
        peersLock.unlock()

        call.resolve()
    }

    // 로컬 audio track 생성 + peer connection 에 추가. W3C 의 getUserMedia + addTrack 에 해당.
    // libwebrtc 가 RTCAudioSession 통해 mic 자동 캡처하므로 별도 capture 호출 없음.
    @objc func start(_ call: CAPPluginCall) {
        guard let peerId = call.getString("peerId") else {
            call.reject("peerId is required"); return
        }
        peersLock.lock()
        guard var ctx = peers[peerId] else {
            peersLock.unlock()
            call.reject("peerConnection not found for peerId=\(peerId)")
            return
        }
        peersLock.unlock()

        let audioSource = WebRTCPlugin.factory.audioSource(with: nil)
        let audioTrack = WebRTCPlugin.factory.audioTrack(with: audioSource, trackId: "audio0_\(peerId)")
        ctx.peerConnection.add(audioTrack, streamIds: ["stream0_\(peerId)"])

        peersLock.lock()
        ctx.localAudioTrack = audioTrack
        peers[peerId] = ctx
        peersLock.unlock()

        call.resolve()
    }

    @objc func close(_ call: CAPPluginCall) {
        guard let peerId = call.getString("peerId") else {
            call.reject("peerId is required"); return
        }
        peersLock.lock()
        let removed = peers.removeValue(forKey: peerId)
        peersLock.unlock()
        removed?.peerConnection.close()
        call.resolve()
    }

    // MARK: - SDP

    @objc func createOffer(_ call: CAPPluginCall) {
        guard let pc = peerConnection(for: call) else { return }
        let constraints = RTCMediaConstraints(
            mandatoryConstraints: ["OfferToReceiveAudio": "true"],
            optionalConstraints: nil
        )
        pc.offer(for: constraints) { sdp, error in
            if let error = error { call.reject(error.localizedDescription); return }
            guard let sdp = sdp else { call.reject("createOffer returned nil sdp"); return }
            call.resolve(["sdp": sdp.sdp])
        }
    }

    @objc func createAnswer(_ call: CAPPluginCall) {
        guard let pc = peerConnection(for: call) else { return }
        let constraints = RTCMediaConstraints(
            mandatoryConstraints: ["OfferToReceiveAudio": "true"],
            optionalConstraints: nil
        )
        pc.answer(for: constraints) { sdp, error in
            if let error = error { call.reject(error.localizedDescription); return }
            guard let sdp = sdp else { call.reject("createAnswer returned nil sdp"); return }
            call.resolve(["sdp": sdp.sdp])
        }
    }

    @objc func setLocalDescription(_ call: CAPPluginCall) {
        guard let pc = peerConnection(for: call),
              let sdpString = call.getString("sdp"),
              let typeString = call.getString("type"),
              let type = sdpType(from: typeString)
        else {
            call.reject("type/sdp required (and type ∈ offer|answer)"); return
        }
        let sessionDescription = RTCSessionDescription(type: type, sdp: sdpString)
        pc.setLocalDescription(sessionDescription) { error in
            if let error = error { call.reject(error.localizedDescription); return }
            call.resolve()
        }
    }

    @objc func setRemoteDescription(_ call: CAPPluginCall) {
        guard let pc = peerConnection(for: call),
              let sdpString = call.getString("sdp"),
              let typeString = call.getString("type"),
              let type = sdpType(from: typeString)
        else {
            call.reject("type/sdp required (and type ∈ offer|answer)"); return
        }
        let sessionDescription = RTCSessionDescription(type: type, sdp: sdpString)
        pc.setRemoteDescription(sessionDescription) { error in
            if let error = error { call.reject(error.localizedDescription); return }
            call.resolve()
        }
    }

    // MARK: - ICE

    @objc func addIceCandidate(_ call: CAPPluginCall) {
        guard let pc = peerConnection(for: call),
              let sdp = call.getString("candidate")
        else {
            call.reject("candidate required"); return
        }
        let sdpMid = call.getString("sdpMid")
        let sdpMLineIndex = Int32(call.getInt("sdpMLineIndex") ?? 0)
        let candidate = RTCIceCandidate(sdp: sdp, sdpMLineIndex: sdpMLineIndex, sdpMid: sdpMid)
        pc.add(candidate) { error in
            if let error = error { call.reject(error.localizedDescription); return }
            call.resolve()
        }
    }

    // MARK: - mic toggle

    @objc func setMicEnabled(_ call: CAPPluginCall) {
        guard let peerId = call.getString("peerId") else {
            call.reject("peerId is required"); return
        }
        let enabled = call.getBool("enabled") ?? true
        peersLock.lock()
        let track = peers[peerId]?.localAudioTrack
        peersLock.unlock()
        track?.isEnabled = enabled
        call.resolve()
    }

    // MARK: - audio routing (RTCAudioSession 통제)

    // 통화 진입 시점 (JS 의 onConnectionStateChange === "connected" 또는 첫 ontrack 직후) 에 호출.
    // libwebrtc 의 RTCAudioSession 으로 카테고리·모드·옵션 + isAudioEnabled 를 일괄 설정.
    // - mode .voiceChat → 자연 default = Receiver (이어피스 정책 만족)
    // - .allowBluetoothHFP → BT 헤드셋 지원
    // - useManualAudio + isAudioEnabled=true 로 우리가 audio engine lifecycle 통제
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

    @objc func setSpeaker(_ call: CAPPluginCall) {
        let on = call.getBool("on") ?? false
        do {
            try WebRTCPlugin.audioDevice.setSpeaker(on: on)
            call.resolve()
        } catch {
            call.reject(error.localizedDescription)
        }
    }

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

    // MARK: - 녹음 파일 관리 (Phase 2)

    @objc func startFileRecording(_ call: CAPPluginCall) {
        guard let callId = call.getString("callId").flatMap(Int64.init) ?? (call.getInt("callId").map { Int64($0) }) else {
            call.reject("callId is required (Long)")
            return
        }
        do {
            let path = try WebRTCPlugin.audioDevice.startFileRecording(callId: callId)
            call.resolve(["filePath": path])
        } catch {
            call.reject(error.localizedDescription)
        }
    }

    @objc func stopFileRecording(_ call: CAPPluginCall) {
        guard let result = WebRTCPlugin.audioDevice.stopFileRecording() else {
            call.resolve([:])
            return
        }
        call.resolve([
            "filePath": result.filePath,
            "sizeBytes": result.sizeBytes,
            "durationMs": result.durationMs,
        ])
    }

    @objc func listPendingRecordings(_ call: CAPPluginCall) {
        do {
            let items = try AudioRecordingADM.listPendingRecordings()
            let mapped = items.map { item -> [String: Any] in
                [
                    "callId": item.callId,
                    "filePath": item.filePath,
                    "sizeBytes": item.sizeBytes,
                ]
            }
            call.resolve(["items": mapped])
        } catch {
            call.reject(error.localizedDescription)
        }
    }

    @objc func deleteRecordingFile(_ call: CAPPluginCall) {
        guard let path = call.getString("filePath") else {
            call.reject("filePath is required")
            return
        }
        do {
            try AudioRecordingADM.deleteRecordingFile(at: path)
            call.resolve()
        } catch {
            call.reject(error.localizedDescription)
        }
    }

    // S3 presigned PUT URL 로 file 을 stream 업로드. JS fetch 보다 메모리 효율적 (큰 파일도 chunk stream).
    @objc func uploadRecordingFile(_ call: CAPPluginCall) {
        guard let filePath = call.getString("filePath"),
              let urlString = call.getString("url"),
              let contentType = call.getString("contentType"),
              let putURL = URL(string: urlString) else {
            call.reject("filePath/url/contentType required")
            return
        }
        let fileURL = URL(fileURLWithPath: filePath)
        var request = URLRequest(url: putURL)
        request.httpMethod = "PUT"
        request.setValue(contentType, forHTTPHeaderField: "Content-Type")

        // 진단 — 보낸 측 정보 (S3 SignatureDoesNotMatch / AccessDenied 추적용)
        let fileSize = (try? FileManager.default.attributesOfItem(atPath: filePath)[.size] as? Int) ?? -1
        NSLog("[uploadRecordingFile] PUT host=\(putURL.host ?? "?") path=\(putURL.path) contentType=\(contentType) fileSize=\(fileSize)")

        let task = URLSession.shared.uploadTask(with: request, fromFile: fileURL) { data, response, error in
            if let error = error {
                call.reject(error.localizedDescription)
                return
            }
            guard let httpResponse = response as? HTTPURLResponse else {
                call.reject("invalid response")
                return
            }
            if (200..<300).contains(httpResponse.statusCode) {
                call.resolve(["statusCode": httpResponse.statusCode])
            } else {
                // S3 는 4xx/5xx 본문에 XML 로 <Code>...</Code><Message>...</Message> 를 담아준다.
                let body = data.flatMap { String(data: $0, encoding: .utf8) } ?? "(no body)"
                NSLog("[uploadRecordingFile] HTTP \(httpResponse.statusCode) responseBody=\(body)")
                call.reject("HTTP \(httpResponse.statusCode)")
            }
        }
        task.resume()
    }

    // MARK: - helpers

    private func peerConnection(for call: CAPPluginCall) -> RTCPeerConnection? {
        guard let peerId = call.getString("peerId") else {
            call.reject("peerId is required"); return nil
        }
        peersLock.lock()
        let pc = peers[peerId]?.peerConnection
        peersLock.unlock()
        if pc == nil {
            call.reject("peerConnection not found for peerId=\(peerId)")
        }
        return pc
    }

    private func sdpType(from string: String) -> RTCSdpType? {
        switch string {
        case "offer": return .offer
        case "answer": return .answer
        case "prAnswer": return .prAnswer
        case "rollback": return .rollback
        default: return nil
        }
    }
}

// RTCPeerConnectionDelegate 어댑터. Capacitor notifyListeners 로 JS 에 이벤트 전달.
// thread: WebRTC delegate 콜백은 worker thread 일 수 있음 — emit 클로저는 Capacitor 가 main 으로 마샬링.
final class PluginPeerConnectionDelegate: NSObject, RTCPeerConnectionDelegate {
    private let peerId: String
    private let emit: (_ event: String, _ data: [String: Any]) -> Void

    init(peerId: String, emit: @escaping (_ event: String, _ data: [String: Any]) -> Void) {
        self.peerId = peerId
        self.emit = emit
        super.init()
    }

    // 연결 상태 변경
    func peerConnection(_ peerConnection: RTCPeerConnection, didChange newState: RTCPeerConnectionState) {
        emit("connectionStateChange", [
            "peerId": peerId,
            "state": connectionStateString(newState),
        ])
    }

    // ICE candidate 발생
    func peerConnection(_ peerConnection: RTCPeerConnection, didGenerate candidate: RTCIceCandidate) {
        emit("iceCandidate", [
            "peerId": peerId,
            "candidate": candidate.sdp,
            "sdpMid": candidate.sdpMid as Any,
            "sdpMLineIndex": Int(candidate.sdpMLineIndex),
        ])
    }

    // remote audio track 도착 — JS 측에 알림 (audio playback 자체는 RTCAudioSession 으로 자동 흐름)
    func peerConnection(_ peerConnection: RTCPeerConnection, didAdd rtpReceiver: RTCRtpReceiver, streams mediaStreams: [RTCMediaStream]) {
        guard rtpReceiver.track is RTCAudioTrack else { return }
        emit("track", [
            "peerId": peerId,
            "kind": "audio",
        ])
    }

    // 미사용 콜백들 — 빈 구현 (Objective-C protocol 충족용)
    func peerConnection(_ peerConnection: RTCPeerConnection, didChange stateChanged: RTCSignalingState) {}
    func peerConnection(_ peerConnection: RTCPeerConnection, didAdd stream: RTCMediaStream) {}
    func peerConnection(_ peerConnection: RTCPeerConnection, didRemove stream: RTCMediaStream) {}
    func peerConnectionShouldNegotiate(_ peerConnection: RTCPeerConnection) {}
    func peerConnection(_ peerConnection: RTCPeerConnection, didChange newState: RTCIceConnectionState) {}
    func peerConnection(_ peerConnection: RTCPeerConnection, didChange newState: RTCIceGatheringState) {}
    func peerConnection(_ peerConnection: RTCPeerConnection, didRemove candidates: [RTCIceCandidate]) {}
    func peerConnection(_ peerConnection: RTCPeerConnection, didOpen dataChannel: RTCDataChannel) {}

    private func connectionStateString(_ state: RTCPeerConnectionState) -> String {
        switch state {
        case .new: return "new"
        case .connecting: return "connecting"
        case .connected: return "connected"
        case .disconnected: return "disconnected"
        case .failed: return "failed"
        case .closed: return "closed"
        @unknown default: return "unknown"
        }
    }
}
