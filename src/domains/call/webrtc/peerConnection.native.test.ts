import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Native libwebrtc plugin path 만 검증. 같은 파일의 web path 테스트는
// peerConnection.test.ts 에 있고 mock 셋업이 다르므로 별도 파일로 분리.

const listenerHandlers = new Map<string, (data: unknown) => void>();
const removeMock = vi.fn().mockResolvedValue(undefined);

// Android 네이티브 환경으로 mock — #193 부터 native 경로는 iOS 전용이 아니라
// 네이티브 플랫폼 공통이다. (web 경로 테스트는 peerConnection.test.ts)
vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => true,
    getPlatform: () => "android",
  },
  registerPlugin: vi.fn(() => ({})),
}));
vi.mock("@/lib/native/webrtcPlugin", () => ({
  isIosNative: () => false,
  NativeWebRTC: {
    createPeerConnection: vi.fn().mockResolvedValue(undefined),
    start: vi.fn().mockResolvedValue(undefined),
    createOffer: vi.fn().mockResolvedValue({ sdp: "v=0\r\noffer-sdp" }),
    createAnswer: vi.fn().mockResolvedValue({ sdp: "v=0\r\nanswer-sdp" }),
    setLocalDescription: vi.fn().mockResolvedValue(undefined),
    setRemoteDescription: vi.fn().mockResolvedValue(undefined),
    addIceCandidate: vi.fn().mockResolvedValue(undefined),
    setMicEnabled: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    addListener: vi.fn(async (event: string, cb: (data: unknown) => void) => {
      listenerHandlers.set(event, cb);
      return { remove: removeMock };
    }),
  },
}));

import { NativeWebRTC } from "@/lib/native/webrtcPlugin";
import { createPeerSession } from "./peerConnection";

const flushMicrotasks = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  listenerHandlers.clear();
  removeMock.mockClear();
  vi.mocked(NativeWebRTC.createPeerConnection).mockClear();
  vi.mocked(NativeWebRTC.start).mockClear();
  vi.mocked(NativeWebRTC.createOffer).mockClear();
  vi.mocked(NativeWebRTC.createAnswer).mockClear();
  vi.mocked(NativeWebRTC.setLocalDescription).mockClear();
  vi.mocked(NativeWebRTC.setRemoteDescription).mockClear();
  vi.mocked(NativeWebRTC.addIceCandidate).mockClear();
  vi.mocked(NativeWebRTC.setMicEnabled).mockClear();
  vi.mocked(NativeWebRTC.close).mockClear();
  vi.mocked(NativeWebRTC.addListener).mockClear();
});

afterEach(() => {
  vi.clearAllMocks();
});

const noopCallbacks = {
  onLocalIce: vi.fn(),
  onRemoteTrack: vi.fn(),
  onConnectionStateChange: vi.fn(),
};

describe("createPeerSession (native libwebrtc path)", () => {
  it("session 생성 시 createPeerConnection + 3개 listener 등록", async () => {
    createPeerSession(noopCallbacks);
    await flushMicrotasks();

    expect(NativeWebRTC.createPeerConnection).toHaveBeenCalledOnce();
    expect(NativeWebRTC.addListener).toHaveBeenCalledTimes(3);
    const events = vi
      .mocked(NativeWebRTC.addListener)
      .mock.calls.map((c) => c[0]);
    expect(events).toContain("iceCandidate");
    expect(events).toContain("connectionStateChange");
    expect(events).toContain("track");
  });

  it("start() 는 native start 호출", async () => {
    const session = createPeerSession(noopCallbacks);
    await session.start();
    expect(NativeWebRTC.start).toHaveBeenCalledOnce();
  });

  it("createOffer() 는 native createOffer + setLocalDescription 후 SDP 반환", async () => {
    const session = createPeerSession(noopCallbacks);
    const sdp = await session.createOffer();

    expect(NativeWebRTC.createOffer).toHaveBeenCalledOnce();
    expect(NativeWebRTC.setLocalDescription).toHaveBeenCalledWith(
      expect.objectContaining({ type: "offer", sdp: "v=0\r\noffer-sdp" }),
    );
    expect(sdp).toBe("v=0\r\noffer-sdp");
  });

  it("acceptOffer(sdp) 는 setRemoteDescription → createAnswer → setLocalDescription 후 answer SDP 반환", async () => {
    const session = createPeerSession(noopCallbacks);
    const sdp = await session.acceptOffer("v=0\r\nremote-offer");

    expect(NativeWebRTC.setRemoteDescription).toHaveBeenCalledWith(
      expect.objectContaining({ type: "offer", sdp: "v=0\r\nremote-offer" }),
    );
    expect(NativeWebRTC.createAnswer).toHaveBeenCalledOnce();
    expect(NativeWebRTC.setLocalDescription).toHaveBeenCalledWith(
      expect.objectContaining({ type: "answer", sdp: "v=0\r\nanswer-sdp" }),
    );
    expect(sdp).toBe("v=0\r\nanswer-sdp");
  });

  it("acceptAnswer(sdp) 는 setRemoteDescription 만 호출", async () => {
    const session = createPeerSession(noopCallbacks);
    await session.acceptAnswer("v=0\r\nremote-answer");

    expect(NativeWebRTC.setRemoteDescription).toHaveBeenCalledWith(
      expect.objectContaining({ type: "answer", sdp: "v=0\r\nremote-answer" }),
    );
    expect(NativeWebRTC.createAnswer).not.toHaveBeenCalled();
  });

  it("addRemoteIce 는 remoteDescription 이전에는 buffering, 설정 후 flush", async () => {
    const session = createPeerSession(noopCallbacks);
    await flushMicrotasks();

    const candidate = {
      candidate: "candidate:1",
      sdpMid: "0",
      sdpMLineIndex: 0,
    };
    await session.addRemoteIce(candidate);
    expect(NativeWebRTC.addIceCandidate).not.toHaveBeenCalled();

    await session.acceptOffer("v=0\r\nremote-offer");
    expect(NativeWebRTC.addIceCandidate).toHaveBeenCalledWith(
      expect.objectContaining({
        candidate: "candidate:1",
        sdpMid: "0",
        sdpMLineIndex: 0,
      }),
    );
  });

  it("addRemoteIce 는 remoteDescription 설정 후 즉시 addIceCandidate", async () => {
    const session = createPeerSession(noopCallbacks);
    await session.acceptOffer("v=0\r\nremote-offer");

    const candidate = {
      candidate: "candidate:2",
      sdpMid: "0",
      sdpMLineIndex: 0,
    };
    await session.addRemoteIce(candidate);

    expect(NativeWebRTC.addIceCandidate).toHaveBeenCalledWith(
      expect.objectContaining({ candidate: "candidate:2" }),
    );
  });

  it("setMicEnabled 은 native setMicEnabled forward", async () => {
    const session = createPeerSession(noopCallbacks);
    await flushMicrotasks();

    session.setMicEnabled(false);
    expect(NativeWebRTC.setMicEnabled).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false }),
    );

    session.setMicEnabled(true);
    expect(NativeWebRTC.setMicEnabled).toHaveBeenLastCalledWith(
      expect.objectContaining({ enabled: true }),
    );
  });

  it("ICE candidate 이벤트는 onLocalIce 로 전달", async () => {
    const onLocalIce = vi.fn();
    createPeerSession({
      onLocalIce,
      onRemoteTrack: vi.fn(),
      onConnectionStateChange: vi.fn(),
    });
    await flushMicrotasks();

    const peerId = vi.mocked(NativeWebRTC.createPeerConnection).mock.calls[0][0]
      .peerId;
    const handler = listenerHandlers.get("iceCandidate")!;
    handler({
      peerId,
      candidate: "candidate:99",
      sdpMid: "0",
      sdpMLineIndex: 0,
    });

    expect(onLocalIce).toHaveBeenCalledWith({
      candidate: "candidate:99",
      sdpMid: "0",
      sdpMLineIndex: 0,
    });
  });

  it("다른 peerId 의 ICE 이벤트는 무시", async () => {
    const onLocalIce = vi.fn();
    createPeerSession({
      onLocalIce,
      onRemoteTrack: vi.fn(),
      onConnectionStateChange: vi.fn(),
    });
    await flushMicrotasks();

    const handler = listenerHandlers.get("iceCandidate")!;
    handler({
      peerId: "other-peer",
      candidate: "candidate:99",
      sdpMid: "0",
      sdpMLineIndex: 0,
    });

    expect(onLocalIce).not.toHaveBeenCalled();
  });

  it("connectionStateChange 이벤트는 onConnectionStateChange 로 전달", async () => {
    const onConnectionStateChange = vi.fn();
    createPeerSession({
      onLocalIce: vi.fn(),
      onRemoteTrack: vi.fn(),
      onConnectionStateChange,
    });
    await flushMicrotasks();

    const peerId = vi.mocked(NativeWebRTC.createPeerConnection).mock.calls[0][0]
      .peerId;
    const handler = listenerHandlers.get("connectionStateChange")!;
    handler({ peerId, state: "connected" });

    expect(onConnectionStateChange).toHaveBeenCalledWith("connected");
  });

  it("track 이벤트는 onRemoteTrack 으로 전달 (dummy MediaStream)", async () => {
    const onRemoteTrack = vi.fn();
    createPeerSession({
      onLocalIce: vi.fn(),
      onRemoteTrack,
      onConnectionStateChange: vi.fn(),
    });
    await flushMicrotasks();

    const peerId = vi.mocked(NativeWebRTC.createPeerConnection).mock.calls[0][0]
      .peerId;
    const handler = listenerHandlers.get("track")!;
    handler({ peerId, kind: "audio" });

    expect(onRemoteTrack).toHaveBeenCalledOnce();
    expect(onRemoteTrack.mock.calls[0][0]).toBeInstanceOf(MediaStream);
  });

  it("close() 는 listener remove + native close 호출", async () => {
    const session = createPeerSession(noopCallbacks);
    await flushMicrotasks();

    session.close();
    await flushMicrotasks();
    await flushMicrotasks();

    expect(removeMock).toHaveBeenCalledTimes(3);
    expect(NativeWebRTC.close).toHaveBeenCalledOnce();
  });

  it("close() 후 setMicEnabled 는 무시된다", async () => {
    const session = createPeerSession(noopCallbacks);
    await flushMicrotasks();

    session.close();
    vi.mocked(NativeWebRTC.setMicEnabled).mockClear();

    session.setMicEnabled(false);

    expect(NativeWebRTC.setMicEnabled).not.toHaveBeenCalled();
  });

  it("close() 는 멱등 (두 번 호출해도 안전)", async () => {
    const session = createPeerSession(noopCallbacks);
    await flushMicrotasks();

    session.close();
    session.close();
    await flushMicrotasks();
    await flushMicrotasks();

    expect(NativeWebRTC.close).toHaveBeenCalledOnce();
  });
});
