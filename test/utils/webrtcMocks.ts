import { afterEach, vi } from "vitest";

// ICE 후보 초기화 타입 (RTCIceCandidateInit의 fake 버전)
export type FakeIceCandidateInit = {
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number | null;
};

// 세션 디스크립션 초기화 타입 (RTCSessionDescriptionInit의 fake 버전)
export type FakeSessionDescriptionInit = {
  type: "offer" | "answer";
  sdp: string;
};

/**
 * jsdom에 존재하지 않는 RTCPeerConnection을 대체하는 Fake 클래스.
 * 단위 테스트에서 WebRTC 동작을 시뮬레이션하기 위해 사용한다.
 */
export class FakeRTCPeerConnection {
  static instances: FakeRTCPeerConnection[] = [];

  static last(): FakeRTCPeerConnection {
    return FakeRTCPeerConnection.instances[
      FakeRTCPeerConnection.instances.length - 1
    ];
  }

  static reset() {
    FakeRTCPeerConnection.instances = [];
  }

  onicecandidate:
    | ((e: { candidate: FakeIceCandidateInit | null }) => void)
    | null = null;
  ontrack: ((e: { streams: MediaStream[] }) => void) | null = null;
  onconnectionstatechange: ((e: Event) => void) | null = null;

  connectionState: RTCPeerConnectionState = "new";
  remoteDescription: FakeSessionDescriptionInit | null = null;
  localDescription: FakeSessionDescriptionInit | null = null;

  addedTracks: MediaStreamTrack[] = [];
  addedIceCandidates: FakeIceCandidateInit[] = [];

  constructor(_config?: RTCConfiguration) {
    FakeRTCPeerConnection.instances.push(this);
  }

  createOffer = vi.fn<[], Promise<FakeSessionDescriptionInit>>(async () => ({
    type: "offer",
    sdp: "v=0\r\noffer-sdp",
  }));

  createAnswer = vi.fn<[], Promise<FakeSessionDescriptionInit>>(async () => ({
    type: "answer",
    sdp: "v=0\r\nanswer-sdp",
  }));

  setLocalDescription = vi.fn(async (desc: FakeSessionDescriptionInit) => {
    this.localDescription = desc;
  });

  setRemoteDescription = vi.fn(async (desc: FakeSessionDescriptionInit) => {
    this.remoteDescription = desc;
  });

  addIceCandidate = vi.fn(async (c: FakeIceCandidateInit) => {
    this.addedIceCandidates.push(c);
  });

  addTrack = vi.fn((track: MediaStreamTrack) => {
    this.addedTracks.push(track);
    return {} as RTCRtpSender;
  });

  close = vi.fn(() => {
    this.connectionState = "closed";
  });

  /** 연결 상태 변경을 시뮬레이션한다 */
  simulateConnectionState(state: RTCPeerConnectionState) {
    this.connectionState = state;
    this.onconnectionstatechange?.(new Event("connectionstatechange"));
  }

  /** ICE 후보 수신을 시뮬레이션한다 */
  simulateIceCandidate(candidate: FakeIceCandidateInit | null) {
    this.onicecandidate?.({ candidate });
  }

  /** 원격 트랙 수신을 시뮬레이션한다 */
  simulateRemoteTrack(stream: MediaStream) {
    this.ontrack?.({ streams: [stream] });
  }
}

// RTCPeerConnection 글로벌을 Fake 클래스로 대체
vi.stubGlobal("RTCPeerConnection", FakeRTCPeerConnection);

/** 오디오 트랙 하나를 포함한 가짜 MediaStream을 생성한다 */
export function createFakeAudioStream(): MediaStream {
  const track = {
    kind: "audio",
    enabled: true,
    stop: vi.fn(),
  } as unknown as MediaStreamTrack;

  return {
    getTracks: () => [track],
    getAudioTracks: () => [track],
  } as unknown as MediaStream;
}

// navigator.mediaDevices.getUserMedia 를 대체하는 mock
export const getUserMediaMock = vi.fn(async () => createFakeAudioStream());

Object.defineProperty(navigator, "mediaDevices", {
  configurable: true,
  value: { getUserMedia: getUserMediaMock },
});

// 각 테스트 종료 후 인스턴스 목록 및 mock 상태를 초기화한다
afterEach(() => {
  FakeRTCPeerConnection.reset();
  getUserMediaMock.mockClear();
  getUserMediaMock.mockImplementation(async () => createFakeAudioStream());
});
