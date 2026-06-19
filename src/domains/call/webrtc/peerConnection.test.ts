import { describe, expect, it, vi } from "vitest";
import {
  FakeRTCPeerConnection,
  createFakeAudioStream,
  getUserMediaMock,
} from "../../../../test/utils/webrtcMocks";
import { createPeerSession } from "./peerConnection";

const noopCallbacks = {
  onLocalIce: vi.fn(),
  onRemoteTrack: vi.fn(),
  onConnectionStateChange: vi.fn(),
};

describe("createPeerSession", () => {
  it("start() 는 getUserMedia(audio) 를 호출하고 트랙을 pc 에 추가한다", async () => {
    const session = createPeerSession({
      onLocalIce: vi.fn(),
      onRemoteTrack: vi.fn(),
      onConnectionStateChange: vi.fn(),
    });

    await session.start();

    expect(getUserMediaMock).toHaveBeenCalledWith({ audio: true });
    const pc = FakeRTCPeerConnection.last();
    expect(pc.addedTracks).toHaveLength(1);
  });

  it("start() 가 거부되면 에러를 throw 한다", async () => {
    getUserMediaMock.mockRejectedValueOnce(new Error("Permission denied"));
    const session = createPeerSession({
      onLocalIce: vi.fn(),
      onRemoteTrack: vi.fn(),
      onConnectionStateChange: vi.fn(),
    });

    await expect(session.start()).rejects.toThrow("Permission denied");
  });

  it("createOffer() 는 setLocalDescription 후 SDP 를 반환한다", async () => {
    const session = createPeerSession(noopCallbacks);
    await session.start();

    const sdp = await session.createOffer();

    const pc = FakeRTCPeerConnection.last();
    expect(pc.createOffer).toHaveBeenCalledOnce();
    expect(pc.setLocalDescription).toHaveBeenCalledOnce();
    expect(sdp).toBe("v=0\r\noffer-sdp");
  });

  it("acceptOffer(sdp) 는 setRemoteDescription → createAnswer → setLocalDescription 후 answer SDP 를 반환한다", async () => {
    const session = createPeerSession(noopCallbacks);
    await session.start();

    const sdp = await session.acceptOffer("v=0\r\nremote-offer");

    const pc = FakeRTCPeerConnection.last();
    expect(pc.setRemoteDescription).toHaveBeenCalledWith({
      type: "offer",
      sdp: "v=0\r\nremote-offer",
    });
    expect(pc.createAnswer).toHaveBeenCalledOnce();
    expect(pc.setLocalDescription).toHaveBeenCalledOnce();
    expect(sdp).toBe("v=0\r\nanswer-sdp");
  });

  it("acceptAnswer(sdp) 는 setRemoteDescription 만 호출한다", async () => {
    const session = createPeerSession(noopCallbacks);
    await session.start();

    await session.acceptAnswer("v=0\r\nremote-answer");

    const pc = FakeRTCPeerConnection.last();
    expect(pc.setRemoteDescription).toHaveBeenCalledWith({
      type: "answer",
      sdp: "v=0\r\nremote-answer",
    });
    expect(pc.createAnswer).not.toHaveBeenCalled();
  });

  it("addRemoteIce 는 remoteDescription 이 없으면 버퍼링하고, 설정 후 flush 한다", async () => {
    const session = createPeerSession(noopCallbacks);
    await session.start();

    const candidate = {
      candidate: "candidate:1",
      sdpMid: "0",
      sdpMLineIndex: 0,
    };
    await session.addRemoteIce(candidate);

    const pc = FakeRTCPeerConnection.last();
    expect(pc.addIceCandidate).not.toHaveBeenCalled();

    await session.acceptOffer("v=0\r\nremote-offer");

    expect(pc.addIceCandidate).toHaveBeenCalledWith(candidate);
  });

  it("addRemoteIce 는 remoteDescription 설정 후라면 즉시 addIceCandidate 한다", async () => {
    const session = createPeerSession(noopCallbacks);
    await session.start();
    await session.acceptOffer("v=0\r\nremote-offer");

    const candidate = {
      candidate: "candidate:2",
      sdpMid: "0",
      sdpMLineIndex: 0,
    };
    await session.addRemoteIce(candidate);

    const pc = FakeRTCPeerConnection.last();
    expect(pc.addIceCandidate).toHaveBeenCalledWith(candidate);
  });

  it("setMicEnabled(false) 는 모든 audio track 의 enabled 를 false 로 만든다", async () => {
    const session = createPeerSession(noopCallbacks);
    await session.start();

    const pc = FakeRTCPeerConnection.last();
    const track = pc.addedTracks[0];
    expect(track.enabled).toBe(true);

    session.setMicEnabled(false);

    expect(track.enabled).toBe(false);

    session.setMicEnabled(true);
    expect(track.enabled).toBe(true);
  });

  it("로컬 ICE 후보는 onLocalIce 콜백으로 전달된다", async () => {
    const onLocalIce = vi.fn();
    const session = createPeerSession({
      onLocalIce,
      onRemoteTrack: vi.fn(),
      onConnectionStateChange: vi.fn(),
    });
    await session.start();

    const pc = FakeRTCPeerConnection.last();
    pc.simulateIceCandidate({
      candidate: "candidate:3",
      sdpMid: "0",
      sdpMLineIndex: 0,
    });

    expect(onLocalIce).toHaveBeenCalledWith({
      candidate: "candidate:3",
      sdpMid: "0",
      sdpMLineIndex: 0,
    });
  });

  it("로컬 ICE 후보가 null 이면 onLocalIce 를 호출하지 않는다", async () => {
    const onLocalIce = vi.fn();
    const session = createPeerSession({
      onLocalIce,
      onRemoteTrack: vi.fn(),
      onConnectionStateChange: vi.fn(),
    });
    await session.start();

    const pc = FakeRTCPeerConnection.last();
    pc.simulateIceCandidate(null);

    expect(onLocalIce).not.toHaveBeenCalled();
  });

  it("ontrack 으로 받은 stream 은 onRemoteTrack 콜백으로 전달된다", async () => {
    const onRemoteTrack = vi.fn();
    const session = createPeerSession({
      onLocalIce: vi.fn(),
      onRemoteTrack,
      onConnectionStateChange: vi.fn(),
    });
    await session.start();

    const pc = FakeRTCPeerConnection.last();
    const stream = createFakeAudioStream();
    pc.simulateRemoteTrack(stream);

    expect(onRemoteTrack).toHaveBeenCalledWith(stream);
  });

  it("connectionState 변경은 콜백으로 전달된다", async () => {
    const onConnectionStateChange = vi.fn();
    const session = createPeerSession({
      onLocalIce: vi.fn(),
      onRemoteTrack: vi.fn(),
      onConnectionStateChange,
    });
    await session.start();

    const pc = FakeRTCPeerConnection.last();
    pc.simulateConnectionState("connected");

    expect(onConnectionStateChange).toHaveBeenCalledWith("connected");
  });

  it("close() 는 모든 track stop 후 pc.close 를 호출한다 (mic → pc 순서)", async () => {
    const session = createPeerSession(noopCallbacks);
    await session.start();

    const pc = FakeRTCPeerConnection.last();
    const track = pc.addedTracks[0];

    session.close();

    expect(track.stop).toHaveBeenCalledOnce();
    expect(pc.close).toHaveBeenCalledOnce();
  });

  it("close() 는 멱등하다 (두 번 호출해도 안전)", async () => {
    const session = createPeerSession(noopCallbacks);
    await session.start();

    session.close();
    session.close();

    const pc = FakeRTCPeerConnection.last();
    expect(pc.close).toHaveBeenCalledOnce();
  });
});
