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

export function createPeerSession(cb: PeerSessionCallbacks): PeerSession {
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
