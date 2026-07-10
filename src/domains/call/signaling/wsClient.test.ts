import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ServerMessage } from "./types";
import { createSignalingClient } from "./wsClient";

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  static last(): FakeWebSocket {
    return FakeWebSocket.instances[FakeWebSocket.instances.length - 1];
  }
  static reset() {
    FakeWebSocket.instances = [];
  }

  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  url: string;
  readyState: number = FakeWebSocket.CONNECTING;
  sent: string[] = [];

  onopen: ((e: Event) => void) | null = null;
  onmessage: ((e: MessageEvent) => void) | null = null;
  onclose: ((e: CloseEvent) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  send = vi.fn((data: string) => {
    this.sent.push(data);
  });
  close = vi.fn(() => {
    this.readyState = FakeWebSocket.CLOSED;
  });

  simulateOpen() {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.(new Event("open"));
  }
  simulateMessage(msg: ServerMessage) {
    this.onmessage?.(
      new MessageEvent("message", { data: JSON.stringify(msg) }),
    );
  }
  simulateRawMessage(data: string) {
    this.onmessage?.(new MessageEvent("message", { data }));
  }
  simulateClose(code = 1000, reason = "") {
    this.readyState = FakeWebSocket.CLOSED;
    this.onclose?.(new CloseEvent("close", { code, reason }));
  }
}

beforeEach(() => FakeWebSocket.reset());
afterEach(() => vi.restoreAllMocks());

const baseOpts = {
  userId: 1,
  roomId: "11111111-1111-1111-1111-111111111111",
  baseUrl: "ws://localhost:3000",
};

describe("createSignalingClient", () => {
  it("핸드셰이크 URL 에 userId 와 roomId 쿼리를 포함한다", () => {
    createSignalingClient(baseOpts, {
      WebSocketCtor: FakeWebSocket as unknown as typeof WebSocket,
    });

    const ws = FakeWebSocket.last();
    expect(ws.url).toBe(
      "ws://localhost:3000/ws/signaling?userId=1&roomId=11111111-1111-1111-1111-111111111111",
    );
  });

  it("OPEN 전에 send 하면 큐에 쌓였다가 OPEN 시 flush 된다", () => {
    const client = createSignalingClient(baseOpts, {
      WebSocketCtor: FakeWebSocket as unknown as typeof WebSocket,
    });
    const ws = FakeWebSocket.last();

    client.send({ type: "JOIN" });
    expect(ws.sent).toEqual([]);

    ws.simulateOpen();

    expect(ws.sent).toEqual([JSON.stringify({ type: "JOIN" })]);
  });

  it("OPEN 이후 send 는 즉시 전송된다", () => {
    const client = createSignalingClient(baseOpts, {
      WebSocketCtor: FakeWebSocket as unknown as typeof WebSocket,
    });
    const ws = FakeWebSocket.last();
    ws.simulateOpen();

    client.send({ type: "OFFER", payload: { sdp: "x" } });

    expect(ws.sent).toEqual([
      JSON.stringify({ type: "OFFER", payload: { sdp: "x" } }),
    ]);
  });

  it("onMessage 등록한 핸들러는 파싱된 ServerMessage 를 받는다", () => {
    const client = createSignalingClient(baseOpts, {
      WebSocketCtor: FakeWebSocket as unknown as typeof WebSocket,
    });
    const ws = FakeWebSocket.last();
    const handler = vi.fn();
    client.onMessage(handler);

    ws.simulateMessage({
      type: "READY",
      fromUserId: 99,
      toUserId: 1,
      payload: { callerUserId: 1, calleeUserId: 2 },
    });

    expect(handler).toHaveBeenCalledWith({
      type: "READY",
      fromUserId: 99,
      toUserId: 1,
      payload: { callerUserId: 1, calleeUserId: 2 },
    });
  });

  it("onMessage unsubscribe 후에는 핸들러 호출이 멈춘다", () => {
    const client = createSignalingClient(baseOpts, {
      WebSocketCtor: FakeWebSocket as unknown as typeof WebSocket,
    });
    const ws = FakeWebSocket.last();
    const handler = vi.fn();
    const unsubscribe = client.onMessage(handler);
    ws.simulateMessage({
      type: "HANGUP",
      fromUserId: null,
      toUserId: null,
      payload: null,
    });
    expect(handler).toHaveBeenCalledTimes(1);

    unsubscribe();
    ws.simulateMessage({
      type: "HANGUP",
      fromUserId: null,
      toUserId: null,
      payload: null,
    });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("파싱 실패한 raw 데이터는 핸들러를 호출하지 않는다", () => {
    const client = createSignalingClient(baseOpts, {
      WebSocketCtor: FakeWebSocket as unknown as typeof WebSocket,
    });
    const ws = FakeWebSocket.last();
    const handler = vi.fn();
    client.onMessage(handler);

    ws.simulateRawMessage("not json");

    expect(handler).not.toHaveBeenCalled();
  });

  it("close 호출은 underlying WebSocket 의 close 를 부른다", () => {
    const client = createSignalingClient(baseOpts, {
      WebSocketCtor: FakeWebSocket as unknown as typeof WebSocket,
    });
    const ws = FakeWebSocket.last();

    client.close();

    expect(ws.close).toHaveBeenCalledOnce();
  });
});

// #55: 예기치 못한 close 는 BE 의 disconnect 유예(10초) 안에서 백오프 재접속을 시도하고,
// 재시도 소진 시에만 onClose(→ dropped)를 발화한다. 의도적 close() 는 재접속하지 않는다.
describe("createSignalingClient — 재접속 (#55)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function createClient() {
    const client = createSignalingClient(baseOpts, {
      WebSocketCtor: FakeWebSocket as unknown as typeof WebSocket,
    });
    const handler = vi.fn();
    client.onClose(handler);
    return { client, handler };
  }

  it("예기치 못한 close 시 onClose 를 바로 부르지 않고 백오프 후 재접속한다", () => {
    const { handler } = createClient();
    FakeWebSocket.last().simulateOpen();

    FakeWebSocket.last().simulateClose(1006, "abnormal");
    expect(handler).not.toHaveBeenCalled();
    expect(FakeWebSocket.instances).toHaveLength(1);

    vi.advanceTimersByTime(500);
    expect(FakeWebSocket.instances).toHaveLength(2);
  });

  it("재접속 성공 시 세션이 유지되고 onClose 는 호출되지 않는다", () => {
    const { client, handler } = createClient();
    FakeWebSocket.last().simulateOpen();

    FakeWebSocket.last().simulateClose(1006);
    vi.advanceTimersByTime(500);
    FakeWebSocket.last().simulateOpen();

    client.send({ type: "HANGUP" });
    expect(FakeWebSocket.last().sent).toEqual([JSON.stringify({ type: "HANGUP" })]);
    expect(handler).not.toHaveBeenCalled();
  });

  it("재접속 대기 중 send 는 큐잉되어 재접속 성공 시 flush 된다", () => {
    const { client } = createClient();
    FakeWebSocket.last().simulateOpen();
    FakeWebSocket.last().simulateClose(1006);

    client.send({ type: "OFFER", payload: { sdp: "x" } });

    vi.advanceTimersByTime(500);
    const reconnected = FakeWebSocket.last();
    reconnected.simulateOpen();

    expect(reconnected.sent).toEqual([
      JSON.stringify({ type: "OFFER", payload: { sdp: "x" } }),
    ]);
  });

  it("재시도가 모두 실패하면 그때 onClose 를 1회 호출한다", () => {
    const { handler } = createClient();
    FakeWebSocket.last().simulateOpen();

    // 최초 끊김 + 재시도 4회(0.5/1/2/4s) 전부 실패
    FakeWebSocket.last().simulateClose(1006);
    for (const delay of [500, 1000, 2000, 4000]) {
      vi.advanceTimersByTime(delay);
      FakeWebSocket.last().simulateClose(1006);
    }

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0]).toBeInstanceOf(CloseEvent);
  });

  it("재접속 성공 후 다시 끊기면 재시도 예산이 리셋되어 있다", () => {
    const { handler } = createClient();
    FakeWebSocket.last().simulateOpen();

    // 1차 끊김 → 3회 실패 후 4번째에 성공
    FakeWebSocket.last().simulateClose(1006);
    for (const delay of [500, 1000, 2000]) {
      vi.advanceTimersByTime(delay);
      FakeWebSocket.last().simulateClose(1006);
    }
    vi.advanceTimersByTime(4000);
    FakeWebSocket.last().simulateOpen();

    // 2차 끊김 — 리셋됐으므로 다시 조용히 재접속 시도해야 한다
    FakeWebSocket.last().simulateClose(1006);
    expect(handler).not.toHaveBeenCalled();
    vi.advanceTimersByTime(500);
    FakeWebSocket.last().simulateOpen();
    expect(handler).not.toHaveBeenCalled();
  });

  it("의도적 close() 후에는 재접속하지 않고 onClose 도 부르지 않는다", () => {
    const { client, handler } = createClient();
    FakeWebSocket.last().simulateOpen();

    client.close();
    FakeWebSocket.last().simulateClose(1000);
    vi.advanceTimersByTime(10_000);

    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(handler).not.toHaveBeenCalled();
  });

  it("재접속 대기 중 close() 하면 타이머가 취소된다", () => {
    const { client } = createClient();
    FakeWebSocket.last().simulateOpen();
    FakeWebSocket.last().simulateClose(1006);

    client.close();
    vi.advanceTimersByTime(10_000);

    expect(FakeWebSocket.instances).toHaveLength(1);
  });
});
