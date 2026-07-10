import type { ClientMessage, ServerMessage } from "./types";

export type SignalingClient = {
  send: (msg: ClientMessage) => void;
  onMessage: (handler: (msg: ServerMessage) => void) => () => void;
  onClose: (handler: (e: CloseEvent) => void) => () => void;
  close: () => void;
};

export type SignalingClientOptions = {
  userId: number;
  roomId: string;
  baseUrl: string;
};

export type SignalingClientDeps = {
  WebSocketCtor?: typeof WebSocket;
};

// #55: 예기치 못한 끊김(네트워크 블립, 백그라운드 복귀 등)은 BE 의 disconnect 유예(10초)
// 안에서 백오프 재접속한다. 누적 ~7.5초 + 연결 시간으로 유예 내 승부.
// WebRTC 미디어는 WS 와 독립이므로 재접속 성공 시 통화는 아무 일 없던 것처럼 유지된다.
const RECONNECT_DELAYS_MS = [500, 1_000, 2_000, 4_000];

export function createSignalingClient(
  opts: SignalingClientOptions,
  deps: SignalingClientDeps = {},
): SignalingClient {
  const Ctor = deps.WebSocketCtor ?? WebSocket;
  const url = `${opts.baseUrl}/ws/signaling?userId=${opts.userId}&roomId=${encodeURIComponent(opts.roomId)}`;

  const messageHandlers = new Set<(msg: ServerMessage) => void>();
  const closeHandlers = new Set<(e: CloseEvent) => void>();
  const sendQueue: ClientMessage[] = [];

  let ws: WebSocket;
  let closedByUs = false;
  let retryCount = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    while (sendQueue.length > 0) {
      const m = sendQueue.shift();
      if (m) ws.send(JSON.stringify(m));
    }
  };

  const connect = () => {
    reconnectTimer = null;
    ws = new Ctor(url);

    ws.onopen = () => {
      retryCount = 0;
      flush();
    };
    ws.onmessage = (e: MessageEvent) => {
      let parsed: ServerMessage;
      try {
        parsed = JSON.parse(e.data) as ServerMessage;
      } catch {
        return;
      }
      messageHandlers.forEach((h) => h(parsed));
    };
    ws.onclose = (e: CloseEvent) => {
      if (closedByUs) return;
      if (retryCount < RECONNECT_DELAYS_MS.length) {
        const delay = RECONNECT_DELAYS_MS[retryCount];
        retryCount += 1;
        console.warn(
          `[wsClient] 연결 끊김(code=${e.code}) — ${delay}ms 후 재접속 (${retryCount}/${RECONNECT_DELAYS_MS.length})`,
        );
        reconnectTimer = setTimeout(connect, delay);
        return;
      }
      closeHandlers.forEach((h) => h(e));
    };
  };

  connect();

  return {
    send(msg) {
      if (ws.readyState === Ctor.OPEN) {
        ws.send(JSON.stringify(msg));
      } else {
        // CONNECTING/재접속 대기 중 — 다음 open 시 flush
        sendQueue.push(msg);
      }
    },
    onMessage(handler) {
      messageHandlers.add(handler);
      return () => messageHandlers.delete(handler);
    },
    onClose(handler) {
      closeHandlers.add(handler);
      return () => closeHandlers.delete(handler);
    },
    close() {
      closedByUs = true;
      if (reconnectTimer != null) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      ws.close();
    },
  };
}
