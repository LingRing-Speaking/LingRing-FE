package com.lingring.app;

import android.content.Context;
import android.media.AudioDeviceInfo;
import android.media.AudioManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import org.webrtc.AudioSource;
import org.webrtc.AudioTrack;
import org.webrtc.IceCandidate;
import org.webrtc.MediaConstraints;
import org.webrtc.MediaStream;
import org.webrtc.PeerConnection;
import org.webrtc.PeerConnectionFactory;
import org.webrtc.SdpObserver;
import org.webrtc.SessionDescription;
import org.webrtc.audio.JavaAudioDeviceModule;

import java.util.Collections;
import java.util.List;
import java.util.concurrent.atomic.AtomicLong;

// #193 Phase 0 스파이크 — 머지 금지, 판정 후 제거.
// 단일 기기 루프백(마이크→로컬 PC1→PC2→재생)으로 게이트 3개를 실측한다:
//   ① 네이티브 재생이 이어피스로 기본 라우팅되는가
//   ② MODE_IN_COMMUNICATION 에서 setCommunicationDevice(스피커↔이어피스) 토글이 실효하는가
//   ③ JavaAudioDeviceModule.setSamplesReadyCallback 으로 마이크 PCM 이 도착하는가
// 앱 시작 5초 후 자동 실행, 25초간 5초 간격 토글, 종료 시 요약 로그.
final class WebRtcSpike {
    private static final String TAG = "WebRtcSpike";
    private static final int START_DELAY_MS = 5_000;
    private static final int TOGGLE_INTERVAL_MS = 5_000;
    private static final int RUN_DURATION_MS = 25_000;

    private WebRtcSpike() {
    }

    static void scheduleRun(final Context context) {
        final Context app = context.getApplicationContext();
        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            try {
                run(app);
            } catch (Exception e) {
                Log.e(TAG, "spike failed", e);
            }
        }, START_DELAY_MS);
    }

    private static void run(final Context context) {
        Log.i(TAG, "=== Phase0 스파이크 시작 ===");
        final AudioManager am = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);

        PeerConnectionFactory.initialize(
                PeerConnectionFactory.InitializationOptions.builder(context).createInitializationOptions());

        // 게이트 ③: 마이크 PCM 콜백 카운트
        final AtomicLong samples = new AtomicLong();
        final JavaAudioDeviceModule adm = JavaAudioDeviceModule.builder(context)
                .setSamplesReadyCallback(audioSamples -> {
                    final long n = samples.incrementAndGet();
                    if (n == 1) {
                        Log.i(TAG, "게이트③ 첫 PCM 도착: rate=" + audioSamples.getSampleRate()
                                + "Hz ch=" + audioSamples.getChannelCount()
                                + " bytes=" + audioSamples.getData().length);
                    }
                })
                .createAudioDeviceModule();

        final PeerConnectionFactory factory = PeerConnectionFactory.builder()
                .setAudioDeviceModule(adm)
                .createPeerConnectionFactory();

        // 통화 모드 진입 + 이어피스 기본 (게이트 ①)
        am.setMode(AudioManager.MODE_IN_COMMUNICATION);
        selectDevice(am, AudioDeviceInfo.TYPE_BUILTIN_EARPIECE);
        logRoute(am, "초기(이어피스 기대)");

        // 루프백: pc1(마이크 송신) → pc2(수신·재생)
        final PeerConnection.RTCConfiguration config =
                new PeerConnection.RTCConfiguration(Collections.emptyList());
        final PeerConnection[] pcs = new PeerConnection[2];
        pcs[0] = factory.createPeerConnection(config, observer("pc1", () -> pcs[1]));
        pcs[1] = factory.createPeerConnection(config, observer("pc2", () -> pcs[0]));

        final AudioSource source = factory.createAudioSource(new MediaConstraints());
        final AudioTrack mic = factory.createAudioTrack("spike-mic", source);
        pcs[0].addTrack(mic, List.of("spike-stream"));

        pcs[0].createOffer(sdpObserver("pc1-offer", sdp -> {
            pcs[0].setLocalDescription(sdpObserver("pc1-setLocal", null), sdp);
            pcs[1].setRemoteDescription(sdpObserver("pc2-setRemote", null), sdp);
            pcs[1].createAnswer(sdpObserver("pc2-answer", answer -> {
                pcs[1].setLocalDescription(sdpObserver("pc2-setLocal", null), answer);
                pcs[0].setRemoteDescription(sdpObserver("pc1-setRemote", null), answer);
            }), new MediaConstraints());
        }), new MediaConstraints());

        // 게이트 ②: 5초 간격 스피커↔이어피스 토글, 실효 여부를 getCommunicationDevice 로 실측
        final Handler handler = new Handler(Looper.getMainLooper());
        final int[] step = {0};
        final Runnable toggler = new Runnable() {
            @Override
            public void run() {
                step[0]++;
                final boolean speaker = step[0] % 2 == 1;
                selectDevice(am, speaker
                        ? AudioDeviceInfo.TYPE_BUILTIN_SPEAKER
                        : AudioDeviceInfo.TYPE_BUILTIN_EARPIECE);
                logRoute(am, "토글#" + step[0] + (speaker ? " → 스피커 기대" : " → 이어피스 기대"));
                if (step[0] * TOGGLE_INTERVAL_MS < RUN_DURATION_MS - TOGGLE_INTERVAL_MS) {
                    handler.postDelayed(this, TOGGLE_INTERVAL_MS);
                }
            }
        };
        handler.postDelayed(toggler, TOGGLE_INTERVAL_MS);

        // 종료·요약
        handler.postDelayed(() -> {
            logRoute(am, "종료 직전");
            Log.i(TAG, "게이트③ 판정: PCM 콜백 " + samples.get() + "회 "
                    + (samples.get() > 0 ? "✅" : "❌"));
            pcs[0].dispose();
            pcs[1].dispose();
            source.dispose();
            factory.dispose();
            adm.release();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) am.clearCommunicationDevice();
            am.setMode(AudioManager.MODE_NORMAL);
            Log.i(TAG, "=== Phase0 스파이크 종료 ===");
        }, RUN_DURATION_MS);
    }

    private static void selectDevice(final AudioManager am, final int type) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return;
        for (AudioDeviceInfo device : am.getAvailableCommunicationDevices()) {
            if (device.getType() == type) {
                final boolean ok = am.setCommunicationDevice(device);
                Log.i(TAG, "setCommunicationDevice(type=" + type + ") → " + ok);
                return;
            }
        }
        Log.w(TAG, "type=" + type + " 없음");
    }

    private static void logRoute(final AudioManager am, final String tag) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return;
        final AudioDeviceInfo current = am.getCommunicationDevice();
        Log.i(TAG, tag + " | mode=" + am.getMode()
                + " 실제기기=" + (current != null ? current.getType() : "null")
                + " (1=이어피스, 2=스피커)");
    }

    private static PeerConnection.Observer observer(final String name,
            final java.util.function.Supplier<PeerConnection> counterpart) {
        return new PeerConnection.Observer() {
            @Override
            public void onIceCandidate(final IceCandidate candidate) {
                final PeerConnection other = counterpart.get();
                if (other != null) other.addIceCandidate(candidate);
            }

            @Override
            public void onConnectionChange(final PeerConnection.PeerConnectionState newState) {
                Log.i(TAG, name + " connectionState=" + newState);
            }

            @Override
            public void onAddStream(final MediaStream stream) {
                Log.i(TAG, name + " onAddStream audioTracks=" + stream.audioTracks.size());
            }

            @Override public void onSignalingChange(final PeerConnection.SignalingState s) { }
            @Override public void onIceConnectionChange(final PeerConnection.IceConnectionState s) { }
            @Override public void onIceConnectionReceivingChange(final boolean b) { }
            @Override public void onIceGatheringChange(final PeerConnection.IceGatheringState s) { }
            @Override public void onIceCandidatesRemoved(final IceCandidate[] candidates) { }
            @Override public void onRemoveStream(final MediaStream stream) { }
            @Override public void onDataChannel(final org.webrtc.DataChannel dc) { }
            @Override public void onRenegotiationNeeded() { }
        };
    }

    private static SdpObserver sdpObserver(final String name,
            final java.util.function.Consumer<SessionDescription> onCreated) {
        return new SdpObserver() {
            @Override
            public void onCreateSuccess(final SessionDescription sdp) {
                if (onCreated != null) onCreated.accept(sdp);
            }

            @Override
            public void onCreateFailure(final String error) {
                Log.e(TAG, name + " createFailure: " + error);
            }

            @Override public void onSetSuccess() { }

            @Override
            public void onSetFailure(final String error) {
                Log.e(TAG, name + " setFailure: " + error);
            }
        };
    }
}
