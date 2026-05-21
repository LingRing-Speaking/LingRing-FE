import {
  Capacitor,
  registerPlugin,
  type PluginListenerHandle,
} from "@capacitor/core";

// 방안 3 (#84): native libwebrtc Capacitor plugin 의 JS wrapper.
// iOS 측 ios/App/App/WebRTCPlugin.swift 와 매핑. peerConnection.ts 가 W3C RTCPeerConnection
// 대신 이 plugin 을 통해 native libwebrtc + RTCAudioSession 을 통제한다.
//
// 비-iOS 환경에서는 register 만 되고 실제 호출은 isIosNative() 가드로 차단.

export type IceServer = { urls: string | string[] };

export type SdpType = "offer" | "answer" | "prAnswer" | "rollback";

export type ConnectionState =
  | "new"
  | "connecting"
  | "connected"
  | "disconnected"
  | "failed"
  | "closed"
  | "unknown";

export interface IceCandidatePayload {
  peerId: string;
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number;
}

export interface ConnectionStateChangePayload {
  peerId: string;
  state: ConnectionState;
}

export interface TrackPayload {
  peerId: string;
  kind: "audio";
}

// Phase 2: 녹음 파일 layer
export interface StartFileRecordingResult {
  filePath: string;
}

export interface StopFileRecordingResult {
  filePath?: string;
  sizeBytes?: number;
  durationMs?: number;
}

export interface PendingRecording {
  callId: number;
  filePath: string;
  sizeBytes: number;
}

interface WebRTCPlugin {
  createPeerConnection(opts: {
    peerId: string;
    iceServers: IceServer[];
  }): Promise<void>;
  start(opts: { peerId: string }): Promise<void>;
  createOffer(opts: { peerId: string }): Promise<{ sdp: string }>;
  createAnswer(opts: { peerId: string }): Promise<{ sdp: string }>;
  setLocalDescription(opts: {
    peerId: string;
    type: SdpType;
    sdp: string;
  }): Promise<void>;
  setRemoteDescription(opts: {
    peerId: string;
    type: SdpType;
    sdp: string;
  }): Promise<void>;
  addIceCandidate(opts: {
    peerId: string;
    candidate: string;
    sdpMid: string | null;
    sdpMLineIndex: number;
  }): Promise<void>;
  setMicEnabled(opts: { peerId: string; enabled: boolean }): Promise<void>;
  close(opts: { peerId: string }): Promise<void>;
  configureForCall(): Promise<void>;
  setSpeaker(opts: { on: boolean }): Promise<void>;
  endCall(): Promise<void>;
  // Phase 2: 녹음 파일 관리
  startFileRecording(opts: { callId: number }): Promise<StartFileRecordingResult>;
  stopFileRecording(): Promise<StopFileRecordingResult>;
  listPendingRecordings(): Promise<{ items: PendingRecording[] }>;
  deleteRecordingFile(opts: { filePath: string }): Promise<void>;
  uploadRecordingFile(opts: {
    filePath: string;
    url: string;
    contentType: string;
  }): Promise<{ statusCode: number }>;
  addListener(
    event: "iceCandidate",
    cb: (data: IceCandidatePayload) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    event: "connectionStateChange",
    cb: (data: ConnectionStateChangePayload) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    event: "track",
    cb: (data: TrackPayload) => void,
  ): Promise<PluginListenerHandle>;
}

export const NativeWebRTC = registerPlugin<WebRTCPlugin>("WebRTC");

export const isIosNative = (): boolean =>
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
