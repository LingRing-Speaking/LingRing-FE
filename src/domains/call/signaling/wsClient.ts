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

export function createSignalingClient(
  opts: SignalingClientOptions,
  deps: SignalingClientDeps = {},
): SignalingClient {
  const Ctor = deps.WebSocketCtor ?? WebSocket;
  const url = `${opts.baseUrl}/ws/signaling?userId=${opts.userId}&roomId=${encodeURIComponent(opts.roomId)}`;
  const ws = new Ctor(url);

  const messageHandlers = new Set<(msg: ServerMessage) => void>();
  const closeHandlers = new Set<(e: CloseEvent) => void>();
  const sendQueue: ClientMessage[] = [];

  const flush = () => {
    while (sendQueue.length > 0) {
      const m = sendQueue.shift();
      if (m) ws.send(JSON.stringify(m));
    }
  };

  ws.onopen = () => flush();
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
    closeHandlers.forEach((h) => h(e));
  };

  return {
    send(msg) {
      if (ws.readyState === Ctor.OPEN) {
        ws.send(JSON.stringify(msg));
      } else {
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
      ws.close();
    },
  };
}
