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

  it("onClose 핸들러는 CloseEvent 를 받는다", () => {
    const client = createSignalingClient(baseOpts, {
      WebSocketCtor: FakeWebSocket as unknown as typeof WebSocket,
    });
    const ws = FakeWebSocket.last();
    const handler = vi.fn();
    client.onClose(handler);

    ws.simulateClose(1006, "abnormal");

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0]).toBeInstanceOf(CloseEvent);
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
