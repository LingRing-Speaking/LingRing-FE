import type { PluginListenerHandle } from "@capacitor/core";
import { isIosNative, NativeWebRTC } from "@/lib/native/webrtcPlugin";
import type { IceCandidatePayload } from "../signaling/types";

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
];

export type PeerSession = {
  start: () => Promise<void>;
  createOffer: () => Promise<string>;
  acceptOffer: (remoteSdp: string) => Promise<string>;
  acceptAnswer: (remoteSdp: string) => Promise<void>;
  addRemoteIce: (c: IceCandidatePayload) => Promise<void>;
  setMicEnabled: (enabled: boolean) => void;
  close: () => void;
};

export type PeerSessionCallbacks = {
  onLocalIce: (c: IceCandidatePayload) => void;
  onRemoteTrack: (stream: MediaStream) => void;
  onConnectionStateChange: (state: RTCPeerConnectionState) => void;
};

// 환경에 따라 native libwebrtc plugin 또는 W3C RTCPeerConnection 으로 분기.
// iOS native 환경에서는 WKWebView 의 WebRTC audio engine fight 를 회피하기 위해 native 로
// 우회 (#84 방안 3). 그 외 (web/dev) 는 표준 W3C 사용.
export function createPeerSession(cb: PeerSessionCallbacks): PeerSession {
  if (isIosNative()) return createNativePeerSession(cb);
  return createWebPeerSession(cb);
}

// MARK: - Web (W3C) path

function createWebPeerSession(cb: PeerSessionCallbacks): PeerSession {
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  let localStream: MediaStream | null = null;
  const pendingIce: IceCandidatePayload[] = [];
  let closed = false;

  pc.onicecandidate = (e) => {
    if (!e.candidate) return;
    cb.onLocalIce({
      candidate: e.candidate.candidate,
      sdpMid: e.candidate.sdpMid,
      sdpMLineIndex: e.candidate.sdpMLineIndex,
    });
  };
  pc.ontrack = (e) => {
    if (e.streams[0]) cb.onRemoteTrack(e.streams[0]);
  };
  pc.onconnectionstatechange = () => {
    cb.onConnectionStateChange(pc.connectionState);
  };

  const flushPendingIce = async () => {
    while (pendingIce.length > 0) {
      const c = pendingIce.shift();
      if (c) await pc.addIceCandidate(c);
    }
  };

  return {
    async start() {
      localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStream.getTracks().forEach((t) => pc.addTrack(t, localStream!));
    },
    async createOffer() {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      return offer.sdp ?? "";
    },
    async acceptOffer(remoteSdp) {
      await pc.setRemoteDescription({ type: "offer", sdp: remoteSdp });
      await flushPendingIce();
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      return answer.sdp ?? "";
    },
    async acceptAnswer(remoteSdp) {
      await pc.setRemoteDescription({ type: "answer", sdp: remoteSdp });
      await flushPendingIce();
    },
    async addRemoteIce(c) {
      if (!pc.remoteDescription) {
        pendingIce.push(c);
        return;
      }
      await pc.addIceCandidate(c);
    },
    setMicEnabled(enabled) {
      if (!localStream) return;
      localStream.getAudioTracks().forEach((t) => {
        t.enabled = enabled;
      });
    },
    close() {
      if (closed) return;
      closed = true;
      if (localStream) {
        localStream.getTracks().forEach((t) => t.stop());
        localStream = null;
      }
      pc.close();
    },
  };
}

// MARK: - iOS native (libwebrtc) path

function createNativePeerSession(cb: PeerSessionCallbacks): PeerSession {
  const peerId = generatePeerId();
  const pendingIce: IceCandidatePayload[] = [];
  let remoteDescriptionSet = false;
  let closed = false;
  const listenerHandles: PluginListenerHandle[] = [];

  // peerConnection 생성 + 이벤트 listener 등록은 동기적으로 시작하되 Promise 로 chain.
  // 이 promise 가 resolve 되기 전에 createOffer 등이 호출되면 await 가 큐잉을 보장.
  const ready = (async () => {
    await NativeWebRTC.createPeerConnection({
      peerId,
      iceServers: ICE_SERVERS.map((s) => ({ urls: s.urls })),
    });

    const iceHandle = await NativeWebRTC.addListener("iceCandidate", (data) => {
      if (data.peerId !== peerId) return;
      cb.onLocalIce({
        candidate: data.candidate,
        sdpMid: data.sdpMid,
        sdpMLineIndex: data.sdpMLineIndex,
      });
    });
    listenerHandles.push(iceHandle);

    const stateHandle = await NativeWebRTC.addListener(
      "connectionStateChange",
      (data) => {
        if (data.peerId !== peerId) return;
        cb.onConnectionStateChange(data.state as RTCPeerConnectionState);
      },
    );
    listenerHandles.push(stateHandle);

    const trackHandle = await NativeWebRTC.addListener("track", (data) => {
      if (data.peerId !== peerId) return;
      // native 가 RTCAudioSession 으로 audio 자동 재생. JS 의 audio element 는 dummy MediaStream
      // 으로 호환성만 유지 (UI 의 onRemoteTrack hook 변경 없게).
      cb.onRemoteTrack(new MediaStream());
    });
    listenerHandles.push(trackHandle);
  })();

  const flushPendingIce = async () => {
    while (pendingIce.length > 0) {
      const c = pendingIce.shift();
      if (!c) continue;
      await NativeWebRTC.addIceCandidate({
        peerId,
        candidate: c.candidate,
        sdpMid: c.sdpMid,
        sdpMLineIndex: c.sdpMLineIndex ?? 0,
      });
    }
  };

  return {
    async start() {
      await ready;
      await NativeWebRTC.start({ peerId });
    },
    async createOffer() {
      await ready;
      const { sdp } = await NativeWebRTC.createOffer({ peerId });
      await NativeWebRTC.setLocalDescription({ peerId, type: "offer", sdp });
      return sdp;
    },
    async acceptOffer(remoteSdp) {
      await ready;
      await NativeWebRTC.setRemoteDescription({
        peerId,
        type: "offer",
        sdp: remoteSdp,
      });
      remoteDescriptionSet = true;
      await flushPendingIce();
      const { sdp } = await NativeWebRTC.createAnswer({ peerId });
      await NativeWebRTC.setLocalDescription({ peerId, type: "answer", sdp });
      return sdp;
    },
    async acceptAnswer(remoteSdp) {
      await ready;
      await NativeWebRTC.setRemoteDescription({
        peerId,
        type: "answer",
        sdp: remoteSdp,
      });
      remoteDescriptionSet = true;
      await flushPendingIce();
    },
    async addRemoteIce(c) {
      await ready;
      if (!remoteDescriptionSet) {
        pendingIce.push(c);
        return;
      }
      await NativeWebRTC.addIceCandidate({
        peerId,
        candidate: c.candidate,
        sdpMid: c.sdpMid,
        sdpMLineIndex: c.sdpMLineIndex ?? 0,
      });
    },
    setMicEnabled(enabled) {
      void NativeWebRTC.setMicEnabled({ peerId, enabled });
    },
    close() {
      if (closed) return;
      closed = true;
      // listener 해제 + native peer connection close. ready 가 아직이어도 best-effort.
      void (async () => {
        for (const handle of listenerHandles) {
          await handle.remove().catch(() => {});
        }
        await NativeWebRTC.close({ peerId }).catch(() => {});
      })();
    },
  };
}

function generatePeerId(): string {
  // crypto.randomUUID 가 모든 환경에 있는 것은 아니므로 fallback 포함.
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `peer-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
