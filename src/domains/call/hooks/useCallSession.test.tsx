import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ClientMessage,
  ServerMessage,
} from "../signaling/types";
import { useCallSession } from "./useCallSession";

// --- mocks ---
const sendMock = vi.fn<(msg: ClientMessage) => void>();
const closeWsMock = vi.fn();
const messageHandlers = new Set<(msg: ServerMessage) => void>();
const closeHandlers = new Set<(e: CloseEvent) => void>();

vi.mock("../signaling/wsClient", () => ({
  createSignalingClient: vi.fn(() => ({
    send: sendMock,
    onMessage: (h: (m: ServerMessage) => void) => {
      messageHandlers.add(h);
      return () => messageHandlers.delete(h);
    },
    onClose: (h: (e: CloseEvent) => void) => {
      closeHandlers.add(h);
      return () => closeHandlers.delete(h);
    },
    close: closeWsMock,
  })),
}));

const peerStartMock = vi.fn<() => Promise<void>>(async () => {});
const peerCreateOfferMock = vi.fn(async () => "v=0\r\noffer-sdp");
const peerAcceptOfferMock = vi.fn(async () => "v=0\r\nanswer-sdp");
const peerAcceptAnswerMock = vi.fn(async () => {});
const peerAddRemoteIceMock = vi.fn(async () => {});
const peerSetMicEnabledMock = vi.fn();
const peerCloseMock = vi.fn();
let lastPeerCallbacks: {
  onLocalIce: (c: unknown) => void;
  onRemoteTrack: (s: MediaStream) => void;
  onConnectionStateChange: (s: RTCPeerConnectionState) => void;
} | null = null;

vi.mock("../webrtc/peerConnection", () => ({
  createPeerSession: vi.fn((cb) => {
    lastPeerCallbacks = cb;
    return {
      start: peerStartMock,
      createOffer: peerCreateOfferMock,
      acceptOffer: peerAcceptOfferMock,
      acceptAnswer: peerAcceptAnswerMock,
      addRemoteIce: peerAddRemoteIceMock,
      setMicEnabled: peerSetMicEnabledMock,
      close: peerCloseMock,
    };
  }),
}));

beforeEach(() => {
  sendMock.mockClear();
  closeWsMock.mockClear();
  peerStartMock.mockReset();
  peerStartMock.mockResolvedValue(undefined);
  peerCreateOfferMock.mockReset();
  peerCreateOfferMock.mockResolvedValue("v=0\r\noffer-sdp");
  peerAcceptOfferMock.mockReset();
  peerAcceptOfferMock.mockResolvedValue("v=0\r\nanswer-sdp");
  peerAcceptAnswerMock.mockReset();
  peerAcceptAnswerMock.mockResolvedValue(undefined);
  peerAddRemoteIceMock.mockReset();
  peerAddRemoteIceMock.mockResolvedValue(undefined);
  peerSetMicEnabledMock.mockClear();
  peerCloseMock.mockClear();
  messageHandlers.clear();
  closeHandlers.clear();
  lastPeerCallbacks = null;
});

afterEach(() => {
  vi.clearAllMocks();
});

const dispatchMessage = (msg: ServerMessage) => {
  messageHandlers.forEach((h) => h(msg));
};

const baseOpts = { userId: 1, roomId: "room-uuid", partnerId: 2 };

describe("useCallSession", () => {
  it("마운트 시 status 는 connecting 이다", () => {
    const { result } = renderHook(() => useCallSession(baseOpts));
    expect(result.current.status).toBe("connecting");
  });

  it("start 후 JOIN 을 송신한다", async () => {
    renderHook(() => useCallSession(baseOpts));

    await waitFor(() => expect(peerStartMock).toHaveBeenCalled());
    await waitFor(() =>
      expect(sendMock).toHaveBeenCalledWith({ type: "JOIN" }),
    );
  });

  it("caller 경로: READY(callerUserId=self) → OFFER 송신", async () => {
    renderHook(() => useCallSession(baseOpts));
    await waitFor(() => expect(sendMock).toHaveBeenCalledWith({ type: "JOIN" }));

    await act(async () => {
      dispatchMessage({
        type: "READY",
        fromUserId: 99,
        toUserId: 1,
        payload: { callerUserId: 1, calleeUserId: 2 },
      });
    });

    await waitFor(() =>
      expect(sendMock).toHaveBeenCalledWith({
        type: "OFFER",
        payload: { sdp: "v=0\r\noffer-sdp" },
      }),
    );
  });

  it("caller 경로: ANSWER 수신 → acceptAnswer 호출", async () => {
    renderHook(() => useCallSession(baseOpts));
    await waitFor(() => expect(sendMock).toHaveBeenCalled());

    await act(async () => {
      dispatchMessage({
        type: "READY",
        fromUserId: 99,
        toUserId: 1,
        payload: { callerUserId: 1, calleeUserId: 2 },
      });
    });
    await waitFor(() =>
      expect(sendMock).toHaveBeenCalledWith({
        type: "OFFER",
        payload: { sdp: "v=0\r\noffer-sdp" },
      }),
    );

    await act(async () => {
      dispatchMessage({
        type: "ANSWER",
        fromUserId: 2,
        toUserId: 1,
        payload: { sdp: "v=0\r\nremote-answer" },
      });
    });

    await waitFor(() =>
      expect(peerAcceptAnswerMock).toHaveBeenCalledWith("v=0\r\nremote-answer"),
    );
  });

  it("callee 경로: READY(callerUserId=other) → OFFER 수신 → ANSWER 송신", async () => {
    renderHook(() => useCallSession(baseOpts));
    await waitFor(() => expect(sendMock).toHaveBeenCalledWith({ type: "JOIN" }));

    await act(async () => {
      dispatchMessage({
        type: "READY",
        fromUserId: 99,
        toUserId: 1,
        payload: { callerUserId: 2, calleeUserId: 1 },
      });
    });

    expect(peerCreateOfferMock).not.toHaveBeenCalled();

    await act(async () => {
      dispatchMessage({
        type: "OFFER",
        fromUserId: 2,
        toUserId: 1,
        payload: { sdp: "v=0\r\nremote-offer" },
      });
    });

    await waitFor(() =>
      expect(peerAcceptOfferMock).toHaveBeenCalledWith("v=0\r\nremote-offer"),
    );
    await waitFor(() =>
      expect(sendMock).toHaveBeenCalledWith({
        type: "ANSWER",
        payload: { sdp: "v=0\r\nanswer-sdp" },
      }),
    );
  });

  it("ICE_CANDIDATE 수신은 peer.addRemoteIce 로 전달된다", async () => {
    renderHook(() => useCallSession(baseOpts));
    await waitFor(() => expect(sendMock).toHaveBeenCalled());

    const candidate = {
      candidate: "candidate:1",
      sdpMid: "0",
      sdpMLineIndex: 0,
    };
    await act(async () => {
      dispatchMessage({
        type: "ICE_CANDIDATE",
        fromUserId: 2,
        toUserId: 1,
        payload: candidate,
      });
    });

    await waitFor(() =>
      expect(peerAddRemoteIceMock).toHaveBeenCalledWith(candidate),
    );
  });

  it("로컬 ICE 발생 → ICE_CANDIDATE 송신", async () => {
    renderHook(() => useCallSession(baseOpts));
    await waitFor(() => expect(lastPeerCallbacks).not.toBeNull());

    const candidate = {
      candidate: "candidate:local",
      sdpMid: "0",
      sdpMLineIndex: 0,
    };
    await act(async () => {
      lastPeerCallbacks!.onLocalIce(candidate);
    });

    expect(sendMock).toHaveBeenCalledWith({
      type: "ICE_CANDIDATE",
      payload: candidate,
    });
  });

  it("pc.connectionState='connected' → status='connected'", async () => {
    const { result } = renderHook(() => useCallSession(baseOpts));
    await waitFor(() => expect(lastPeerCallbacks).not.toBeNull());

    await act(async () => {
      lastPeerCallbacks!.onConnectionStateChange("connected");
    });

    expect(result.current.status).toBe("connected");
  });

  it("HANGUP 수신 → status='ended', cleanup, HANGUP 재송신 X", async () => {
    const { result } = renderHook(() => useCallSession(baseOpts));
    await waitFor(() => expect(sendMock).toHaveBeenCalledWith({ type: "JOIN" }));
    sendMock.mockClear();

    await act(async () => {
      dispatchMessage({
        type: "HANGUP",
        fromUserId: 2,
        toUserId: 1,
        payload: null,
      });
    });

    expect(result.current.status).toBe("ended");
    expect(peerCloseMock).toHaveBeenCalled();
    expect(closeWsMock).toHaveBeenCalled();
    expect(sendMock).not.toHaveBeenCalledWith({ type: "HANGUP" });
  });

  it("end() 호출 → HANGUP 송신 후 cleanup, status='ended'", async () => {
    const { result } = renderHook(() => useCallSession(baseOpts));
    await waitFor(() => expect(sendMock).toHaveBeenCalledWith({ type: "JOIN" }));

    await act(async () => {
      result.current.end();
    });

    expect(sendMock).toHaveBeenCalledWith({ type: "HANGUP" });
    expect(peerCloseMock).toHaveBeenCalled();
    expect(closeWsMock).toHaveBeenCalled();
    expect(result.current.status).toBe("ended");
  });

  it("WS 비정상 close → status='ended', HANGUP 재송신 X", async () => {
    const { result } = renderHook(() => useCallSession(baseOpts));
    await waitFor(() => expect(sendMock).toHaveBeenCalled());
    sendMock.mockClear();

    await act(async () => {
      closeHandlers.forEach((h) =>
        h(new CloseEvent("close", { code: 1006 })),
      );
    });

    expect(result.current.status).toBe("ended");
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("getUserMedia 거부 → status='error', errorMessage='마이크 권한이 필요해요'", async () => {
    peerStartMock.mockRejectedValueOnce(new Error("Permission denied"));

    const { result } = renderHook(() => useCallSession(baseOpts));

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.errorMessage).toBe("마이크 권한이 필요해요");
  });

  it("ERROR 메시지 수신 → status='error', errorMessage=payload.message", async () => {
    const { result } = renderHook(() => useCallSession(baseOpts));
    await waitFor(() => expect(sendMock).toHaveBeenCalled());

    await act(async () => {
      dispatchMessage({
        type: "ERROR",
        payload: { code: "MATCH_NOT_FOUND", message: "매치를 찾을 수 없어요" },
      });
    });

    expect(result.current.status).toBe("error");
    expect(result.current.errorMessage).toBe("매치를 찾을 수 없어요");
  });

  it("pc.connectionState='failed' → status='error'", async () => {
    const { result } = renderHook(() => useCallSession(baseOpts));
    await waitFor(() => expect(lastPeerCallbacks).not.toBeNull());

    await act(async () => {
      lastPeerCallbacks!.onConnectionStateChange("failed");
    });

    expect(result.current.status).toBe("error");
    expect(result.current.errorMessage).toBe("통화 연결에 실패했어요");
  });

  it("toggleMute() 는 peer.setMicEnabled 와 isMuted 를 토글한다", async () => {
    const { result } = renderHook(() => useCallSession(baseOpts));
    await waitFor(() => expect(peerStartMock).toHaveBeenCalled());

    expect(result.current.isMuted).toBe(false);

    await act(async () => {
      result.current.toggleMute();
    });

    expect(peerSetMicEnabledMock).toHaveBeenLastCalledWith(false);
    expect(result.current.isMuted).toBe(true);

    await act(async () => {
      result.current.toggleMute();
    });

    expect(peerSetMicEnabledMock).toHaveBeenLastCalledWith(true);
    expect(result.current.isMuted).toBe(false);
  });

  it("unmount 시 cleanup 이 호출된다 (멱등)", async () => {
    const { unmount } = renderHook(() => useCallSession(baseOpts));
    await waitFor(() => expect(sendMock).toHaveBeenCalled());

    unmount();

    expect(peerCloseMock).toHaveBeenCalledTimes(1);
    expect(closeWsMock).toHaveBeenCalledTimes(1);
  });
});
