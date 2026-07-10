package com.lingring.app;

import android.Manifest;
import android.content.Context;
import android.media.AudioManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONArray;
import org.webrtc.AudioSource;
import org.webrtc.AudioTrack;
import org.webrtc.IceCandidate;
import org.webrtc.MediaConstraints;
import org.webrtc.MediaStream;
import org.webrtc.PeerConnection;
import org.webrtc.PeerConnectionFactory;
import org.webrtc.RtpReceiver;
import org.webrtc.SdpObserver;
import org.webrtc.SessionDescription;
import org.webrtc.audio.JavaAudioDeviceModule;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

// #193 Phase 1: Android 네이티브 WebRTC plugin. iOS ios/App/App/WebRTCPlugin.swift 와
// 동일한 JS 계약(src/lib/native/webrtcPlugin.ts)을 구현한다 — JS 는 플랫폼 분기 없이
// 같은 NativeWebRTC 인터페이스를 쓴다.
//
// Phase 1 범위: 시그널링·미디어 (createPeerConnection ~ close, 이벤트 3종).
// 오디오 라우팅(configureForCall/setSpeaker/endCall)은 Phase 2,
// 녹음(startFileRecording ~ uploadRecordingFile)은 Phase 3 에서 추가.
@CapacitorPlugin(
        name = "WebRTC",
        permissions = @Permission(strings = {Manifest.permission.RECORD_AUDIO}, alias = "microphone")
)
public class WebRTCPlugin extends Plugin {

    private static final String MIC_ALIAS = "microphone";

    private PeerConnectionFactory factory;
    private JavaAudioDeviceModule adm;
    private final Map<String, Peer> peers = new ConcurrentHashMap<>();

    private static final class Peer {
        final PeerConnection pc;
        AudioSource source;
        AudioTrack track;

        Peer(final PeerConnection pc) {
            this.pc = pc;
        }
    }

    // MARK: - lifecycle

    @PluginMethod
    public void createPeerConnection(final PluginCall call) {
        final String peerId = call.getString("peerId");
        if (peerId == null) {
            call.reject("peerId is required");
            return;
        }

        final PeerConnection.RTCConfiguration config =
                new PeerConnection.RTCConfiguration(parseIceServers(call));
        config.sdpSemantics = PeerConnection.SdpSemantics.UNIFIED_PLAN;
        config.continualGatheringPolicy =
                PeerConnection.ContinualGatheringPolicy.GATHER_CONTINUALLY;

        final PeerConnection pc = factory().createPeerConnection(config, observer(peerId));
        if (pc == null) {
            call.reject("failed to create PeerConnection");
            return;
        }
        peers.put(peerId, new Peer(pc));
        call.resolve();
    }

    // start = 마이크 캡처 시작 + 로컬 오디오 트랙 부착. WebView 의 getUserMedia 에 해당하므로
    // RECORD_AUDIO 런타임 권한을 여기서 요청한다 (거부 시 reject → JS 가 권한 에러 UI).
    @PluginMethod
    public void start(final PluginCall call) {
        if (getPermissionState(MIC_ALIAS) != com.getcapacitor.PermissionState.GRANTED) {
            requestPermissionForAlias(MIC_ALIAS, call, "onMicPermission");
            return;
        }
        doStart(call);
    }

    @PermissionCallback
    private void onMicPermission(final PluginCall call) {
        if (getPermissionState(MIC_ALIAS) != com.getcapacitor.PermissionState.GRANTED) {
            call.reject("microphone permission denied");
            return;
        }
        doStart(call);
    }

    private void doStart(final PluginCall call) {
        final Peer peer = requirePeer(call);
        if (peer == null) return;

        // 통화 모드 진입 — VoIP 표준. 라우팅 세부(이어피스/스피커)는 Phase 2 에서.
        audioManager().setMode(AudioManager.MODE_IN_COMMUNICATION);

        peer.source = factory().createAudioSource(new MediaConstraints());
        peer.track = factory().createAudioTrack("mic-" + call.getString("peerId"), peer.source);
        peer.pc.addTrack(peer.track, List.of("stream-" + call.getString("peerId")));
        call.resolve();
    }

    @PluginMethod
    public void close(final PluginCall call) {
        final String peerId = call.getString("peerId");
        if (peerId == null) {
            call.reject("peerId is required");
            return;
        }
        final Peer peer = peers.remove(peerId);
        if (peer != null) {
            peer.pc.close();
            peer.pc.dispose();
            if (peer.source != null) peer.source.dispose();
        }
        if (peers.isEmpty()) {
            audioManager().setMode(AudioManager.MODE_NORMAL);
        }
        call.resolve();
    }

    // MARK: - SDP

    @PluginMethod
    public void createOffer(final PluginCall call) {
        final Peer peer = requirePeer(call);
        if (peer == null) return;
        peer.pc.createOffer(createObserver(call, "createOffer"), new MediaConstraints());
    }

    @PluginMethod
    public void createAnswer(final PluginCall call) {
        final Peer peer = requirePeer(call);
        if (peer == null) return;
        peer.pc.createAnswer(createObserver(call, "createAnswer"), new MediaConstraints());
    }

    @PluginMethod
    public void setLocalDescription(final PluginCall call) {
        final Peer peer = requirePeer(call);
        if (peer == null) return;
        final SessionDescription desc = parseDescription(call);
        if (desc == null) return;
        peer.pc.setLocalDescription(setObserver(call), desc);
    }

    @PluginMethod
    public void setRemoteDescription(final PluginCall call) {
        final Peer peer = requirePeer(call);
        if (peer == null) return;
        final SessionDescription desc = parseDescription(call);
        if (desc == null) return;
        peer.pc.setRemoteDescription(setObserver(call), desc);
    }

    @PluginMethod
    public void addIceCandidate(final PluginCall call) {
        final Peer peer = requirePeer(call);
        if (peer == null) return;
        final String candidate = call.getString("candidate");
        if (candidate == null) {
            call.reject("candidate required");
            return;
        }
        final Integer mLineIndex = call.getInt("sdpMLineIndex");
        peer.pc.addIceCandidate(new IceCandidate(
                call.getString("sdpMid"),
                mLineIndex != null ? mLineIndex : 0,
                candidate));
        call.resolve();
    }

    @PluginMethod
    public void setMicEnabled(final PluginCall call) {
        final Peer peer = requirePeer(call);
        if (peer == null) return;
        final Boolean enabled = call.getBoolean("enabled");
        if (peer.track != null && enabled != null) {
            peer.track.setEnabled(enabled);
        }
        call.resolve();
    }

    // MARK: - helpers

    private synchronized PeerConnectionFactory factory() {
        if (factory == null) {
            PeerConnectionFactory.initialize(
                    PeerConnectionFactory.InitializationOptions.builder(getContext())
                            .createInitializationOptions());
            adm = JavaAudioDeviceModule.builder(getContext()).createAudioDeviceModule();
            factory = PeerConnectionFactory.builder()
                    .setAudioDeviceModule(adm)
                    .createPeerConnectionFactory();
        }
        return factory;
    }

    private AudioManager audioManager() {
        return (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
    }

    private Peer requirePeer(final PluginCall call) {
        final String peerId = call.getString("peerId");
        if (peerId == null) {
            call.reject("peerId is required");
            return null;
        }
        final Peer peer = peers.get(peerId);
        if (peer == null) {
            call.reject("peerConnection not found for peerId=" + peerId);
        }
        return peer;
    }

    private List<PeerConnection.IceServer> parseIceServers(final PluginCall call) {
        final List<PeerConnection.IceServer> servers = new ArrayList<>();
        final JSONArray entries = call.getArray("iceServers");
        if (entries == null) return servers;
        try {
            for (int i = 0; i < entries.length(); i++) {
                final Object urls = entries.getJSONObject(i).get("urls");
                if (urls instanceof JSONArray) {
                    final JSONArray urlArray = (JSONArray) urls;
                    final List<String> list = new ArrayList<>();
                    for (int j = 0; j < urlArray.length(); j++) list.add(urlArray.getString(j));
                    servers.add(PeerConnection.IceServer.builder(list).createIceServer());
                } else {
                    servers.add(PeerConnection.IceServer.builder(urls.toString()).createIceServer());
                }
            }
        } catch (Exception e) {
            // 형식 오류는 STUN 없이 진행 (host 후보만으로도 동작 가능한 환경 대비)
        }
        return servers;
    }

    private SessionDescription parseDescription(final PluginCall call) {
        final String type = call.getString("type");
        final String sdp = call.getString("sdp");
        if (type == null || sdp == null
                || !(type.equals("offer") || type.equals("answer"))) {
            call.reject("type/sdp required (and type ∈ offer|answer)");
            return null;
        }
        return new SessionDescription(SessionDescription.Type.fromCanonicalForm(type), sdp);
    }

    private PeerConnection.Observer observer(final String peerId) {
        return new PeerConnection.Observer() {
            @Override
            public void onIceCandidate(final IceCandidate c) {
                final JSObject data = new JSObject();
                data.put("peerId", peerId);
                data.put("candidate", c.sdp);
                data.put("sdpMid", c.sdpMid);
                data.put("sdpMLineIndex", c.sdpMLineIndex);
                notifyListeners("iceCandidate", data);
            }

            @Override
            public void onConnectionChange(final PeerConnection.PeerConnectionState state) {
                final JSObject data = new JSObject();
                data.put("peerId", peerId);
                data.put("state", state.name().toLowerCase());
                notifyListeners("connectionStateChange", data);
            }

            @Override
            public void onAddTrack(final RtpReceiver receiver, final MediaStream[] streams) {
                if (receiver.track() == null || !"audio".equals(receiver.track().kind())) return;
                final JSObject data = new JSObject();
                data.put("peerId", peerId);
                data.put("kind", "audio");
                notifyListeners("track", data);
            }

            @Override public void onSignalingChange(final PeerConnection.SignalingState s) { }
            @Override public void onIceConnectionChange(final PeerConnection.IceConnectionState s) { }
            @Override public void onIceConnectionReceivingChange(final boolean receiving) { }
            @Override public void onIceGatheringChange(final PeerConnection.IceGatheringState s) { }
            @Override public void onIceCandidatesRemoved(final IceCandidate[] candidates) { }
            @Override public void onAddStream(final MediaStream stream) { }
            @Override public void onRemoveStream(final MediaStream stream) { }
            @Override public void onDataChannel(final org.webrtc.DataChannel dc) { }
            @Override public void onRenegotiationNeeded() { }
        };
    }

    private SdpObserver createObserver(final PluginCall call, final String op) {
        return new SdpObserver() {
            @Override
            public void onCreateSuccess(final SessionDescription sdp) {
                final JSObject result = new JSObject();
                result.put("sdp", sdp.description);
                call.resolve(result);
            }

            @Override
            public void onCreateFailure(final String error) {
                call.reject(op + " failed: " + error);
            }

            @Override public void onSetSuccess() { }
            @Override public void onSetFailure(final String error) { }
        };
    }

    private SdpObserver setObserver(final PluginCall call) {
        return new SdpObserver() {
            @Override public void onCreateSuccess(final SessionDescription sdp) { }
            @Override public void onCreateFailure(final String error) { }

            @Override
            public void onSetSuccess() {
                call.resolve();
            }

            @Override
            public void onSetFailure(final String error) {
                call.reject(error);
            }
        };
    }
}
