import { act, renderHook, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  configureCallAudioRoute,
  endCallAudioRoute,
  setSpeakerphone,
} from "@/lib/native/audioRoute";
import type {
  ClientMessage,
  ServerMessage,
} from "../signaling/types";
import { useCallSession } from "./useCallSession";

vi.mock("@/lib/native/audioRoute", () => ({
  setSpeakerphone: vi.fn().mockResolvedValue(undefined),
  configureCallAudioRoute: vi.fn().mockResolvedValue(undefined),
  endCallAudioRoute: vi.fn().mockResolvedValue(undefined),
}));

// --- mocks ---
const sendMock = vi.fn<(msg: ClientMessage) => void>();
const closeWsMock = vi.fn();
const messageHandlers = new Set<(msg: ServerMessage) => void>();
const closeHandlers = new Set<(e: CloseEvent) => void>();
type WsInstance = {
  messageHandlers: Set<(msg: ServerMessage) => void>;
  closeHandlers: Set<(e: CloseEvent) => void>;
};
const wsInstances: WsInstance[] = [];

vi.mock("../signaling/wsClient", () => ({
  createSignalingClient: vi.fn(() => {
    const instance: WsInstance = {
      messageHandlers: new Set(),
      closeHandlers: new Set(),
    };
    wsInstances.push(instance);
    return {
      send: sendMock,
      onMessage: (h: (m: ServerMessage) => void) => {
        instance.messageHandlers.add(h);
        messageHandlers.add(h);
        return () => {
          instance.messageHandlers.delete(h);
          messageHandlers.delete(h);
        };
      },
      onClose: (h: (e: CloseEvent) => void) => {
        instance.closeHandlers.add(h);
        closeHandlers.add(h);
        return () => {
          instance.closeHandlers.delete(h);
          closeHandlers.delete(h);
        };
      },
      close: closeWsMock,
    };
  }),
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
  wsInstances.length = 0;
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

  it("connection 확립 전에는 configureCallAudioRoute 가 호출되지 않는다", async () => {
    renderHook(() => useCallSession(baseOpts));
    await waitFor(() => expect(peerStartMock).toHaveBeenCalled());

    expect(configureCallAudioRoute).not.toHaveBeenCalled();
  });

  it("onConnectionStateChange('connected') 시점에 configureCallAudioRoute 가 호출된다", async () => {
    renderHook(() => useCallSession(baseOpts));
    await waitFor(() => expect(lastPeerCallbacks).not.toBeNull());

    await act(async () => {
      lastPeerCallbacks!.onConnectionStateChange("connected");
    });

    await waitFor(() =>
      expect(configureCallAudioRoute).toHaveBeenCalledTimes(1),
    );
  });

  it("cleanup 시 endCallAudioRoute 가 호출된다", async () => {
    const { unmount } = renderHook(() => useCallSession(baseOpts));
    await waitFor(() => expect(sendMock).toHaveBeenCalledWith({ type: "JOIN" }));

    unmount();

    expect(endCallAudioRoute).toHaveBeenCalled();
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

  it("StrictMode 하에서도 end() 호출 시 HANGUP 을 송신한다", async () => {
    // dev StrictMode 는 effect 를 setup → cleanup → setup 순으로 두 번 실행한다.
    // cleanedUpRef 가 1차 cleanup 이후에도 stale true 로 남으면 end() 가 early return 되어
    // HANGUP 이 송신되지 않는 회귀가 발생한다.
    const { result } = renderHook(() => useCallSession(baseOpts), {
      wrapper: StrictMode,
    });
    await waitFor(() => expect(sendMock).toHaveBeenCalledWith({ type: "JOIN" }));
    sendMock.mockClear();

    await act(async () => {
      result.current.end();
    });

    expect(sendMock).toHaveBeenCalledWith({ type: "HANGUP" });
    expect(result.current.status).toBe("ended");
  });

  it("StrictMode: 1차 effect의 ws onclose 가 비동기로 도착해도 활성 세션을 끊지 않는다", async () => {
    // StrictMode dev 에서 1차 effect 가 만든 ws 의 onclose 이벤트는 1차 cleanup 이 호출한
    // ws.close() 의 결과로 비동기 도착한다. 이 시점엔 이미 2차 effect 가 새 ws 를 만들어
    // wsRef 를 갱신한 뒤이므로, 1차 ws 의 close 핸들러가 활성 세션의 finishEnded 를
    // 트리거해선 안 된다 (그러면 새 ws 가 CONNECTING 중에 close 되어 연결이 끊어짐).
    const { result } = renderHook(() => useCallSession(baseOpts), {
      wrapper: StrictMode,
    });
    await waitFor(() => expect(sendMock).toHaveBeenCalledWith({ type: "JOIN" }));
    await waitFor(() => expect(wsInstances.length).toBe(2));

    // 1차 effect 의 ws 인스턴스의 close 핸들러만 발화 (실제 브라우저에서 ws1.close 이후
    // ws1.onclose 가 비동기로 도착하는 상황을 시뮬레이션)
    await act(async () => {
      wsInstances[0].closeHandlers.forEach((h) =>
        h(new CloseEvent("close", { code: 1000 })),
      );
    });

    // 활성 세션은 여전히 살아있어야 함
    expect(result.current.status).not.toBe("ended");
    expect(result.current.status).not.toBe("error");

    // end() 도 정상 동작해야 함
    sendMock.mockClear();
    await act(async () => {
      result.current.end();
    });
    expect(sendMock).toHaveBeenCalledWith({ type: "HANGUP" });
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

  it("setError 후 ws.close 가 트리거한 close 핸들러는 status='error' 를 유지한다 (race 회귀 방어)", async () => {
    const { result } = renderHook(() => useCallSession(baseOpts));
    await waitFor(() => expect(sendMock).toHaveBeenCalled());

    // ERROR 메시지로 setError 트리거
    await act(async () => {
      dispatchMessage({
        type: "ERROR",
        payload: { code: "X", message: "테스트 에러" },
      });
    });

    expect(result.current.status).toBe("error");

    // 실제 브라우저에서는 ws.close() 가 onclose 핸들러를 비동기로 발화시킴
    // 이때 status 가 "ended" 로 덮어씌워지지 않아야 한다
    await act(async () => {
      closeHandlers.forEach((h) =>
        h(new CloseEvent("close", { code: 1000 })),
      );
    });

    expect(result.current.status).toBe("error");
    expect(result.current.errorMessage).toBe("테스트 에러");
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

  it("visibilitychange visible 복귀 시 remote audio 가 paused 면 play() 를 다시 호출한다", async () => {
    const playMock = vi.fn().mockResolvedValue(undefined);
    const mockAudio = {
      srcObject: {} as MediaStream,
      paused: true,
      play: playMock,
    } as unknown as HTMLAudioElement;

    const { result } = renderHook(() => useCallSession(baseOpts));
    await waitFor(() => expect(sendMock).toHaveBeenCalledWith({ type: "JOIN" }));

    // CallPage 가 ref 를 audio element 에 연결한 상태를 시뮬
    (result.current.remoteAudioRef as { current: HTMLAudioElement | null }).current = mockAudio;

    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(playMock).toHaveBeenCalled();
  });

  it("visibilitychange visible 복귀 시 audio 가 paused 가 아니면 play() 를 호출하지 않는다", async () => {
    const playMock = vi.fn().mockResolvedValue(undefined);
    const mockAudio = {
      srcObject: {} as MediaStream,
      paused: false,
      play: playMock,
    } as unknown as HTMLAudioElement;

    const { result } = renderHook(() => useCallSession(baseOpts));
    await waitFor(() => expect(sendMock).toHaveBeenCalledWith({ type: "JOIN" }));

    (result.current.remoteAudioRef as { current: HTMLAudioElement | null }).current = mockAudio;

    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(playMock).not.toHaveBeenCalled();
  });

  it("초기 isSpeakerOn 은 false 이다 (이어피스 default 정책)", async () => {
    const { result } = renderHook(() => useCallSession(baseOpts));
    await waitFor(() => expect(peerStartMock).toHaveBeenCalled());
    expect(result.current.isSpeakerOn).toBe(false);
  });

  it("toggleSpeaker() 는 setSpeakerphone 호출과 isSpeakerOn 을 토글한다 (false→true→false)", async () => {
    const { result } = renderHook(() => useCallSession(baseOpts));
    await waitFor(() => expect(peerStartMock).toHaveBeenCalled());

    await act(async () => {
      result.current.toggleSpeaker();
    });

    expect(setSpeakerphone).toHaveBeenLastCalledWith(true);
    expect(result.current.isSpeakerOn).toBe(true);

    await act(async () => {
      result.current.toggleSpeaker();
    });

    expect(setSpeakerphone).toHaveBeenLastCalledWith(false);
    expect(result.current.isSpeakerOn).toBe(false);
  });

  it("unmount 후에는 visibilitychange 핸들러가 해제된다", async () => {
    const playMock = vi.fn().mockResolvedValue(undefined);
    const mockAudio = {
      srcObject: {} as MediaStream,
      paused: true,
      play: playMock,
    } as unknown as HTMLAudioElement;

    const { result, unmount } = renderHook(() => useCallSession(baseOpts));
    await waitFor(() => expect(sendMock).toHaveBeenCalled());

    (result.current.remoteAudioRef as { current: HTMLAudioElement | null }).current = mockAudio;
    unmount();

    document.dispatchEvent(new Event("visibilitychange"));

    expect(playMock).not.toHaveBeenCalled();
  });

  describe("상대 미입장 타임아웃", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("connecting 이 15초 지속되면 status='error' 로 종료한다", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const { result } = renderHook(() => useCallSession(baseOpts));
      await waitFor(() => expect(sendMock).toHaveBeenCalledWith({ type: "JOIN" }));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(15_000);
      });

      expect(result.current.status).toBe("error");
      expect(result.current.errorMessage).toBe("상대방과 연결되지 않았어요");
      expect(peerCloseMock).toHaveBeenCalled();
      expect(closeWsMock).toHaveBeenCalled();
    });

    it("connected 이후에는 타임아웃이 발동하지 않는다", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const { result } = renderHook(() => useCallSession(baseOpts));
      await waitFor(() => expect(lastPeerCallbacks).not.toBeNull());

      await act(async () => {
        lastPeerCallbacks!.onConnectionStateChange("connected");
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(20_000);
      });

      expect(result.current.status).toBe("connected");
    });

    it("타임아웃 전에 통화가 끝났으면(ended) 상태를 덮어쓰지 않는다", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const { result } = renderHook(() => useCallSession(baseOpts));
      await waitFor(() => expect(sendMock).toHaveBeenCalledWith({ type: "JOIN" }));

      await act(async () => {
        dispatchMessage({
          type: "HANGUP",
          fromUserId: 2,
          toUserId: 1,
          payload: null,
        });
      });
      expect(result.current.status).toBe("ended");

      await act(async () => {
        await vi.advanceTimersByTimeAsync(20_000);
      });

      expect(result.current.status).toBe("ended");
    });
  });

  describe("endReason (종료 사유)", () => {
    it("초기 endReason 은 null 이다", () => {
      const { result } = renderHook(() => useCallSession(baseOpts));
      expect(result.current.endReason).toBeNull();
    });

    it("end() 기본 호출 → endReason='self'", async () => {
      const { result } = renderHook(() => useCallSession(baseOpts));
      await waitFor(() => expect(sendMock).toHaveBeenCalledWith({ type: "JOIN" }));

      await act(async () => {
        result.current.end();
      });

      expect(result.current.endReason).toBe("self");
    });

    it("end('timeout') → endReason='timeout' 이고 HANGUP 을 송신한다", async () => {
      const { result } = renderHook(() => useCallSession(baseOpts));
      await waitFor(() => expect(sendMock).toHaveBeenCalledWith({ type: "JOIN" }));

      await act(async () => {
        result.current.end("timeout");
      });

      expect(result.current.endReason).toBe("timeout");
      expect(sendMock).toHaveBeenCalledWith({ type: "HANGUP" });
      expect(result.current.status).toBe("ended");
    });

    it("HANGUP 수신 → endReason='peer'", async () => {
      const { result } = renderHook(() => useCallSession(baseOpts));
      await waitFor(() => expect(sendMock).toHaveBeenCalledWith({ type: "JOIN" }));

      await act(async () => {
        dispatchMessage({
          type: "HANGUP",
          fromUserId: 2,
          toUserId: 1,
          payload: null,
        });
      });

      expect(result.current.endReason).toBe("peer");
    });

    it("WS 비정상 close → endReason='dropped'", async () => {
      const { result } = renderHook(() => useCallSession(baseOpts));
      await waitFor(() => expect(sendMock).toHaveBeenCalled());

      await act(async () => {
        closeHandlers.forEach((h) => h(new CloseEvent("close", { code: 1006 })));
      });

      expect(result.current.endReason).toBe("dropped");
    });
  });
});
