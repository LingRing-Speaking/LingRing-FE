# 음성 P2P 통화 연결 구현 플랜

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 매칭 성공 후 `/call/:roomId`로 진입하면 시그널링 서버를 거쳐 1:1 음성 P2P 연결을 수립하고, mute/end 등 기본 통화 컨트롤을 제공하는 Mock UI를 구현한다.

**Architecture:** 시그널링(WS) 클라이언트 / WebRTC 피어 / 오케스트레이터 hook 3개 레이어로 분리해 단위 테스트 가능하게 한다. 모든 사이드이펙트(마이크 점유, RTCPeerConnection, WebSocket)는 hook의 cleanup으로 멱등하게 회수한다 (mic→pc→ws 순서).

**Tech Stack:** React 18, TypeScript, TanStack Query v5, React Router v7, Vitest, MSW v2, 브라우저 네이티브 `WebSocket` / `RTCPeerConnection` / `getUserMedia` (신규 의존성 없음)

**Spec:** `docs/superpowers/specs/2026-04-29-voice-p2p-connection-design.md`

---

## File Structure

| 경로 | 액션 | 책임 |
| --- | --- | --- |
| `test/utils/webrtcMocks.ts` | 신규 | `FakeRTCPeerConnection`, `createFakeAudioStream`, `getUserMediaMock` |
| `test/setup.ts` | 수정 | `webrtcMocks` 사이드이펙트 import + 테스트 간 reset |
| `src/config/env.ts` | 수정 | `wsBaseUrl` 추가 (`http→ws` / `https→wss` 치환) |
| `src/domains/call/signaling/types.ts` | 신규 | `ClientMessage` / `ServerMessage` discriminated union |
| `src/domains/call/signaling/wsClient.ts` | 신규 | `createSignalingClient` — JSON 직렬화/역직렬화 + 핸들러 등록 |
| `src/domains/call/signaling/wsClient.test.ts` | 신규 | URL 구성 / send / onMessage / onClose / close |
| `src/domains/call/webrtc/peerConnection.ts` | 신규 | `createPeerSession` — getUserMedia + RTCPeerConnection + ICE 버퍼링 |
| `src/domains/call/webrtc/peerConnection.test.ts` | 신규 | offer/answer/ICE flow + mute toggle + close 멱등 |
| `src/domains/call/hooks/useCallSession.ts` | 신규 | 오케스트레이터 hook — 상태 머신 + cleanup |
| `src/domains/call/hooks/useCallSession.test.tsx` | 신규 | caller/callee 시나리오 + 에러/HANGUP 분기 |
| `src/pages/call/CallTimer.tsx` | 신규 | MM:SS 타이머 |
| `src/pages/call/CallTimer.test.tsx` | 신규 | active 토글, 포맷 |
| `src/pages/call/EndConfirmSheet.tsx` | 신규 | 종료 확인 바텀시트 |
| `src/pages/call/EndConfirmSheet.test.tsx` | 신규 | open / 버튼 |
| `src/pages/call/CallPage.tsx` | 신규 | 통화 화면 — status별 분기 + 버튼 와이어링 |
| `src/pages/call/CallPage.test.tsx` | 신규 | status별 렌더 / mute / end / redirect |
| `src/domains/matching/types.ts` | 수정 | `MatchingStatus`에 `roomId: string \| null` |
| `src/mocks/handlers.ts` | 수정 | matching 응답에 `roomId` 필드 |
| `src/domains/matching/hooks/useMatchingStatus.test.tsx` | 수정 | mock 응답에 `roomId` 포함 |
| `src/domains/matching/api/matchingApi.test.ts` | 수정 | mock 응답에 `roomId` 포함 |
| `src/pages/matching/MatchingPage.tsx` | 수정 | `MATCHED` 수신 시 `navigate('/call/:roomId', {state, replace})` + cancel 가드 해제 |
| `src/pages/matching/MatchingPage.test.tsx` | 수정 | MATCHED → navigate 케이스 + cancel 미호출 검증 |
| `src/App.tsx` | 수정 | `<Route path="/call/:roomId" element={<CallPage />} />` |

---

## Task 1: 테스트 fake 셋업 (RTCPeerConnection / getUserMedia)

WebRTC 단위 테스트가 jsdom에 없는 `RTCPeerConnection`과 `navigator.mediaDevices.getUserMedia`를 사용하므로 fake 모듈을 만들고 `test/setup.ts`에서 사이드이펙트로 활성화한다.

**Files:**
- Create: `test/utils/webrtcMocks.ts`
- Modify: `test/setup.ts`

- [ ] **Step 1: `test/utils/webrtcMocks.ts` 작성**

```ts
import { afterEach, vi } from "vitest";

export type FakeIceCandidateInit = {
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number | null;
};

export type FakeSessionDescriptionInit = {
  type: "offer" | "answer";
  sdp: string;
};

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

  simulateConnectionState(state: RTCPeerConnectionState) {
    this.connectionState = state;
    this.onconnectionstatechange?.(new Event("connectionstatechange"));
  }
  simulateIceCandidate(candidate: FakeIceCandidateInit | null) {
    this.onicecandidate?.({ candidate });
  }
  simulateRemoteTrack(stream: MediaStream) {
    this.ontrack?.({ streams: [stream] });
  }
}

vi.stubGlobal("RTCPeerConnection", FakeRTCPeerConnection);

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

export const getUserMediaMock = vi.fn(async () => createFakeAudioStream());

Object.defineProperty(navigator, "mediaDevices", {
  configurable: true,
  value: { getUserMedia: getUserMediaMock },
});

afterEach(() => {
  FakeRTCPeerConnection.reset();
  getUserMediaMock.mockClear();
  getUserMediaMock.mockImplementation(async () => createFakeAudioStream());
});
```

- [ ] **Step 2: `test/setup.ts`에 사이드이펙트 import 추가**

기존 `test/setup.ts`(20행)의 `import "@testing-library/jest-dom/vitest";` 아래에 한 줄 추가:

```ts
import "@testing-library/jest-dom/vitest";
import "./utils/webrtcMocks";
import { afterAll, afterEach, beforeAll, vi } from "vitest";
import { server } from "@/mocks/server";

class IntersectionObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
  root = null;
  rootMargin = "";
  thresholds = [];
}
vi.stubGlobal("IntersectionObserver", IntersectionObserverMock);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

- [ ] **Step 3: 기존 테스트 회귀 확인**

Run: `npm run test:run`
Expected: 전체 테스트 통과 (신규 fake가 기존 테스트에 영향 없어야 함). 실패 시 fake 정의 검토.

- [ ] **Step 4: 커밋**

```bash
git add test/utils/webrtcMocks.ts test/setup.ts
git commit -m "test: add WebRTC and getUserMedia fakes for unit tests"
```

---

## Task 2: env.ts에 wsBaseUrl 추가

WS URL은 `apiBaseUrl`에서 scheme만 치환해 도출 (별도 환경변수 X — YAGNI).

**Files:**
- Modify: `src/config/env.ts`
- Modify: `src/config/env.test.ts`

- [ ] **Step 1: 실패 테스트 추가**

`src/config/env.test.ts` 기존 `describe("env", ...)` 블록 안에 새 `it` 만 추가 (기존 케이스는 그대로 유지):

```ts
it("wsBaseUrl 은 apiBaseUrl 의 http 스킴을 ws 로 치환한다", async () => {
  const { env } = await import("./env");
  expect(env.wsBaseUrl).toBe("ws://localhost:3000");
});
```

기존 파일 전체 모습:

```ts
import { describe, expect, it } from "vitest";

describe("env", () => {
  it("Vite 가 주입한 VITE_API_BASE_URL 과 VITE_DEV_USER_ID 를 노출한다", async () => {
    const { env } = await import("./env");
    expect(env.apiBaseUrl).toBe("http://localhost:3000");
    expect(env.devUserId).toBe(1);
  });

  it("wsBaseUrl 은 apiBaseUrl 의 http 스킴을 ws 로 치환한다", async () => {
    const { env } = await import("./env");
    expect(env.wsBaseUrl).toBe("ws://localhost:3000");
  });
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `npm run test:run -- src/config/env.test.ts`
Expected: `env.wsBaseUrl is undefined` 등으로 FAIL.

- [ ] **Step 3: `env.ts` 구현**

`src/config/env.ts`:

```ts
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
const devUserIdRaw = import.meta.env.VITE_DEV_USER_ID;

if (!apiBaseUrl) {
  throw new Error("VITE_API_BASE_URL is not set");
}
if (!devUserIdRaw) {
  throw new Error("VITE_DEV_USER_ID is not set");
}

export const env = {
  apiBaseUrl,
  wsBaseUrl: apiBaseUrl.replace(/^http/, "ws"),
  devUserId: Number(devUserIdRaw),
};
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm run test:run -- src/config/env.test.ts`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/config/env.ts src/config/env.test.ts
git commit -m "feat(env): derive wsBaseUrl from apiBaseUrl scheme"
```

---

## Task 3: 시그널링 메시지 타입 정의

순수 타입 파일 — 테스트 불필요. typecheck로만 검증.

**Files:**
- Create: `src/domains/call/signaling/types.ts`

- [ ] **Step 1: 타입 작성**

`src/domains/call/signaling/types.ts`:

```ts
export type SdpPayload = { sdp: string };

export type IceCandidatePayload = {
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number | null;
};

export type ReadyPayload = {
  callerUserId: number;
  calleeUserId: number;
};

export type ErrorPayload = {
  code: string;
  message: string;
};

export type ClientMessage =
  | { type: "JOIN" }
  | { type: "OFFER"; payload: SdpPayload }
  | { type: "ANSWER"; payload: SdpPayload }
  | { type: "ICE_CANDIDATE"; payload: IceCandidatePayload }
  | { type: "HANGUP" };

export type ServerMessage =
  | {
      type: "READY";
      fromUserId: number;
      toUserId: number;
      payload: ReadyPayload;
    }
  | {
      type: "OFFER" | "ANSWER";
      fromUserId: number;
      toUserId: number;
      payload: SdpPayload;
    }
  | {
      type: "ICE_CANDIDATE";
      fromUserId: number;
      toUserId: number;
      payload: IceCandidatePayload;
    }
  | {
      type: "HANGUP";
      fromUserId: number | null;
      toUserId: number | null;
      payload: null;
    }
  | { type: "ERROR"; payload: ErrorPayload };
```

- [ ] **Step 2: typecheck 통과 확인**

Run: `npm run typecheck`
Expected: 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add src/domains/call/signaling/types.ts
git commit -m "feat(signaling): define ClientMessage and ServerMessage types"
```

---

## Task 4: signaling/wsClient — WebSocket 래퍼

JSON 직렬화/역직렬화 + 다중 핸들러 등록만. 비즈니스 로직 없음. 테스트는 fake `WebSocket` 클래스를 옵션으로 주입해 진행.

**Files:**
- Create: `src/domains/call/signaling/wsClient.ts`
- Create: `src/domains/call/signaling/wsClient.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

`src/domains/call/signaling/wsClient.test.ts`:

```ts
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
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `npm run test:run -- src/domains/call/signaling/wsClient.test.ts`
Expected: `Cannot find module './wsClient'` 등으로 FAIL.

- [ ] **Step 3: `wsClient.ts` 구현**

`src/domains/call/signaling/wsClient.ts`:

```ts
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
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm run test:run -- src/domains/call/signaling/wsClient.test.ts`
Expected: 8개 케이스 PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/domains/call/signaling/wsClient.ts src/domains/call/signaling/wsClient.test.ts
git commit -m "feat(signaling): add WebSocket client with send queue and message dispatch"
```

---

## Task 5: webrtc/peerConnection — RTCPeerConnection 래퍼

`getUserMedia` + `RTCPeerConnection` + ICE 버퍼링 + mute 토글. fake는 Task 1에서 셋업했으므로 그대로 사용.

**Files:**
- Create: `src/domains/call/webrtc/peerConnection.ts`
- Create: `src/domains/call/webrtc/peerConnection.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

`src/domains/call/webrtc/peerConnection.test.ts`:

```ts
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
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `npm run test:run -- src/domains/call/webrtc/peerConnection.test.ts`
Expected: 모든 케이스 FAIL (`Cannot find module ./peerConnection`).

- [ ] **Step 3: `peerConnection.ts` 구현**

`src/domains/call/webrtc/peerConnection.ts`:

```ts
import type { IceCandidatePayload } from "../signaling/types";

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
];

export type PeerSession = {
  start: () => Promise<void>;
  createOffer: () => Promise<string>;
  acceptOffer: (remoteSdp: string) => Promise<string>;
  acceptAnswer: (remoteSdp: string) => Promise<void>;
  addRemoteIce: (c: IceCandidatePayload) => Promise<void>;
  setMicEnabled: (enabled: boolean) => void;
  close: () => void;
};

export type PeerSessionCallbacks = {
  onLocalIce: (c: IceCandidatePayload) => void;
  onRemoteTrack: (stream: MediaStream) => void;
  onConnectionStateChange: (state: RTCPeerConnectionState) => void;
};

export function createPeerSession(cb: PeerSessionCallbacks): PeerSession {
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  let localStream: MediaStream | null = null;
  const pendingIce: IceCandidatePayload[] = [];
  let closed = false;

  pc.onicecandidate = (e) => {
    if (!e.candidate) return;
    cb.onLocalIce({
      candidate: e.candidate.candidate,
      sdpMid: e.candidate.sdpMid,
      sdpMLineIndex: e.candidate.sdpMLineIndex,
    });
  };
  pc.ontrack = (e) => {
    if (e.streams[0]) cb.onRemoteTrack(e.streams[0]);
  };
  pc.onconnectionstatechange = () => {
    cb.onConnectionStateChange(pc.connectionState);
  };

  const flushPendingIce = async () => {
    while (pendingIce.length > 0) {
      const c = pendingIce.shift();
      if (c) await pc.addIceCandidate(c);
    }
  };

  return {
    async start() {
      localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStream.getTracks().forEach((t) => pc.addTrack(t, localStream!));
    },
    async createOffer() {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      return offer.sdp ?? "";
    },
    async acceptOffer(remoteSdp) {
      await pc.setRemoteDescription({ type: "offer", sdp: remoteSdp });
      await flushPendingIce();
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      return answer.sdp ?? "";
    },
    async acceptAnswer(remoteSdp) {
      await pc.setRemoteDescription({ type: "answer", sdp: remoteSdp });
      await flushPendingIce();
    },
    async addRemoteIce(c) {
      if (!pc.remoteDescription) {
        pendingIce.push(c);
        return;
      }
      await pc.addIceCandidate(c);
    },
    setMicEnabled(enabled) {
      if (!localStream) return;
      localStream.getAudioTracks().forEach((t) => {
        t.enabled = enabled;
      });
    },
    close() {
      if (closed) return;
      closed = true;
      if (localStream) {
        localStream.getTracks().forEach((t) => t.stop());
        localStream = null;
      }
      pc.close();
    },
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm run test:run -- src/domains/call/webrtc/peerConnection.test.ts`
Expected: 14개 케이스 PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/domains/call/webrtc/peerConnection.ts src/domains/call/webrtc/peerConnection.test.ts
git commit -m "feat(webrtc): add peer session wrapper with ICE buffering and mic toggle"
```

---

## Task 6: hooks/useCallSession — 오케스트레이터 hook

signaling/wsClient + webrtc/peerConnection 을 결합해 상태 머신을 운영. 두 모듈은 `vi.mock`으로 fake 주입.

**Files:**
- Create: `src/domains/call/hooks/useCallSession.ts`
- Create: `src/domains/call/hooks/useCallSession.test.tsx`

- [ ] **Step 1: 실패 테스트 작성**

`src/domains/call/hooks/useCallSession.test.tsx`:

```tsx
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ClientMessage,
  ServerMessage,
} from "../signaling/types";
import { useCallSession } from "./useCallSession";

// --- mocks ---
const sendMock = vi.fn<[ClientMessage], void>();
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

const peerStartMock = vi.fn<[], Promise<void>>(async () => {});
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
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `npm run test:run -- src/domains/call/hooks/useCallSession.test.tsx`
Expected: 모든 케이스 FAIL.

- [ ] **Step 3: `useCallSession.ts` 구현**

`src/domains/call/hooks/useCallSession.ts`:

```ts
import { useEffect, useRef, useState } from "react";
import { env } from "@/config/env";
import type {
  ServerMessage,
  IceCandidatePayload,
} from "../signaling/types";
import { createSignalingClient, type SignalingClient } from "../signaling/wsClient";
import { createPeerSession, type PeerSession } from "../webrtc/peerConnection";

export type CallStatus = "connecting" | "connected" | "ended" | "error";

const PERMISSION_DENIED_MESSAGE = "마이크 권한이 필요해요";
const CONNECTION_FAILED_MESSAGE = "통화 연결에 실패했어요";

export type UseCallSessionOptions = {
  userId: number;
  roomId: string;
  partnerId: number;
};

export type UseCallSessionResult = {
  status: CallStatus;
  errorMessage: string | null;
  isMuted: boolean;
  toggleMute: () => void;
  end: () => void;
  remoteAudioRef: React.RefObject<HTMLAudioElement>;
};

export function useCallSession(
  opts: UseCallSessionOptions,
): UseCallSessionResult {
  const [status, setStatus] = useState<CallStatus>("connecting");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  const peerRef = useRef<PeerSession | null>(null);
  const wsRef = useRef<SignalingClient | null>(null);
  const cleanedUpRef = useRef(false);
  const statusRef = useRef<CallStatus>("connecting");
  statusRef.current = status;

  const setError = (msg: string) => {
    if (cleanedUpRef.current) return;
    cleanup();
    setErrorMessage(msg);
    setStatus("error");
  };

  const cleanup = () => {
    if (cleanedUpRef.current) return;
    cleanedUpRef.current = true;
    peerRef.current?.close();
    wsRef.current?.close();
  };

  const finishEnded = () => {
    cleanup();
    setStatus("ended");
  };

  useEffect(() => {
    let cancelled = false;

    const peer = createPeerSession({
      onLocalIce: (c: IceCandidatePayload) => {
        wsRef.current?.send({ type: "ICE_CANDIDATE", payload: c });
      },
      onRemoteTrack: (stream) => {
        const el = remoteAudioRef.current;
        if (!el) return;
        el.srcObject = stream;
        void el.play().catch(() => {
          // iOS 자동재생 정책에 막힐 수 있음 — known issue, spec 참조
        });
      },
      onConnectionStateChange: (s) => {
        if (s === "connected") setStatus("connected");
        else if (s === "failed") setError(CONNECTION_FAILED_MESSAGE);
      },
    });
    peerRef.current = peer;

    const ws = createSignalingClient({
      userId: opts.userId,
      roomId: opts.roomId,
      baseUrl: env.wsBaseUrl,
    });
    wsRef.current = ws;

    ws.onMessage((msg: ServerMessage) => {
      void handleMessage(msg);
    });
    ws.onClose(() => {
      if (statusRef.current === "ended" || statusRef.current === "error") return;
      finishEnded();
    });

    const handleMessage = async (msg: ServerMessage) => {
      try {
        switch (msg.type) {
          case "READY": {
            if (msg.payload.callerUserId === opts.userId) {
              const sdp = await peer.createOffer();
              ws.send({ type: "OFFER", payload: { sdp } });
            }
            break;
          }
          case "OFFER": {
            const sdp = await peer.acceptOffer(msg.payload.sdp);
            ws.send({ type: "ANSWER", payload: { sdp } });
            break;
          }
          case "ANSWER": {
            await peer.acceptAnswer(msg.payload.sdp);
            break;
          }
          case "ICE_CANDIDATE": {
            await peer.addRemoteIce(msg.payload);
            break;
          }
          case "HANGUP": {
            finishEnded();
            break;
          }
          case "ERROR": {
            setError(msg.payload.message || CONNECTION_FAILED_MESSAGE);
            break;
          }
        }
      } catch {
        setError(CONNECTION_FAILED_MESSAGE);
      }
    };

    (async () => {
      try {
        await peer.start();
        if (cancelled) return;
        ws.send({ type: "JOIN" });
      } catch {
        if (cancelled) return;
        setError(PERMISSION_DENIED_MESSAGE);
      }
    })();

    return () => {
      cancelled = true;
      cleanup();
    };
    // userId/roomId/partnerId 변경 시에만 재실행
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.userId, opts.roomId, opts.partnerId]);

  return {
    status,
    errorMessage,
    isMuted,
    toggleMute: () => {
      const next = !isMuted;
      peerRef.current?.setMicEnabled(!next);
      setIsMuted(next);
    },
    end: () => {
      if (cleanedUpRef.current) return;
      wsRef.current?.send({ type: "HANGUP" });
      finishEnded();
    },
    remoteAudioRef,
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm run test:run -- src/domains/call/hooks/useCallSession.test.tsx`
Expected: 모든 케이스 PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/domains/call/hooks/useCallSession.ts src/domains/call/hooks/useCallSession.test.tsx
git commit -m "feat(call): add useCallSession orchestrator hook with state machine"
```

---

## Task 7: pages/call/CallTimer

`active=true` 일 때만 1초 단위로 카운트하는 MM:SS 컴포넌트.

**Files:**
- Create: `src/pages/call/CallTimer.tsx`
- Create: `src/pages/call/CallTimer.test.tsx`

- [ ] **Step 1: 실패 테스트 작성**

`src/pages/call/CallTimer.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CallTimer } from "./CallTimer";

describe("CallTimer", () => {
  afterEach(() => vi.useRealTimers());

  it("초기 렌더는 00:00 이다", () => {
    render(<CallTimer active={false} />);
    expect(screen.getByText("00:00")).toBeInTheDocument();
  });

  it("active=true 면 1초마다 카운트가 올라간다", () => {
    vi.useFakeTimers();
    render(<CallTimer active={true} />);

    vi.advanceTimersByTime(1000);
    expect(screen.getByText("00:01")).toBeInTheDocument();

    vi.advanceTimersByTime(59000);
    expect(screen.getByText("01:00")).toBeInTheDocument();
  });

  it("active=false 면 카운트가 멈춘다", () => {
    vi.useFakeTimers();
    const { rerender } = render(<CallTimer active={true} />);

    vi.advanceTimersByTime(3000);
    expect(screen.getByText("00:03")).toBeInTheDocument();

    rerender(<CallTimer active={false} />);
    vi.advanceTimersByTime(5000);

    expect(screen.getByText("00:03")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `npm run test:run -- src/pages/call/CallTimer.test.tsx`
Expected: FAIL.

- [ ] **Step 3: `CallTimer.tsx` 구현**

`src/pages/call/CallTimer.tsx`:

```tsx
import { useEffect, useState } from "react";

const pad2 = (n: number) => String(n).padStart(2, "0");

export function CallTimer({ active }: { active: boolean }) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [active]);

  const m = pad2(Math.floor(seconds / 60));
  const s = pad2(seconds % 60);
  return (
    <span
      aria-label="통화 시간"
      className="text-[28px] font-bold leading-none tracking-[-0.02em] tabular-nums text-gray-900"
    >
      {m}:{s}
    </span>
  );
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm run test:run -- src/pages/call/CallTimer.test.tsx`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/pages/call/CallTimer.tsx src/pages/call/CallTimer.test.tsx
git commit -m "feat(call): add CallTimer component"
```

---

## Task 8: pages/call/EndConfirmSheet

`pages/matching/CancelConfirmSheet`와 동일 패턴 — 문구만 다름.

**Files:**
- Create: `src/pages/call/EndConfirmSheet.tsx`
- Create: `src/pages/call/EndConfirmSheet.test.tsx`

- [ ] **Step 1: 실패 테스트 작성**

`src/pages/call/EndConfirmSheet.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EndConfirmSheet } from "./EndConfirmSheet";

describe("EndConfirmSheet", () => {
  it("open=true 면 dialog 가 활성 상태로 노출된다", () => {
    render(
      <EndConfirmSheet open={true} onKeep={vi.fn()} onEnd={vi.fn()} />,
    );

    const dialog = screen.getByRole("dialog", {
      name: "통화를 종료할까요?",
    });
    expect(dialog).not.toHaveAttribute("aria-hidden", "true");
  });

  it("open=false 면 dialog 가 hidden 으로 마크된다", () => {
    render(
      <EndConfirmSheet open={false} onKeep={vi.fn()} onEnd={vi.fn()} />,
    );

    expect(
      screen.getByRole("dialog", { hidden: true }),
    ).toHaveAttribute("aria-hidden", "true");
  });

  it("'계속하기' 클릭 시 onKeep 이 호출된다", async () => {
    const user = userEvent.setup();
    const onKeep = vi.fn();
    render(
      <EndConfirmSheet open={true} onKeep={onKeep} onEnd={vi.fn()} />,
    );

    await user.click(screen.getByRole("button", { name: "계속하기" }));
    expect(onKeep).toHaveBeenCalledOnce();
  });

  it("'종료하기' 클릭 시 onEnd 가 호출된다", async () => {
    const user = userEvent.setup();
    const onEnd = vi.fn();
    render(
      <EndConfirmSheet open={true} onKeep={vi.fn()} onEnd={onEnd} />,
    );

    await user.click(screen.getByRole("button", { name: "종료하기" }));
    expect(onEnd).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `npm run test:run -- src/pages/call/EndConfirmSheet.test.tsx`
Expected: FAIL.

- [ ] **Step 3: `EndConfirmSheet.tsx` 구현**

`src/pages/call/EndConfirmSheet.tsx`:

```tsx
type Props = {
  open: boolean;
  onKeep: () => void;
  onEnd: () => void;
};

export function EndConfirmSheet({ open, onKeep, onEnd }: Props) {
  return (
    <>
      <button
        type="button"
        aria-label="시트 닫기"
        aria-hidden={!open}
        onClick={onKeep}
        tabIndex={open ? 0 : -1}
        className={`absolute inset-0 z-10 cursor-default bg-black/40 transition-opacity duration-200 ${
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="end-sheet-title"
        aria-hidden={!open}
        className={`absolute inset-x-0 bottom-0 z-[11] rounded-t-3xl bg-white px-5 pb-7 pt-6 shadow-[0_-10px_40px_rgba(0,0,0,0.15)] transition-transform duration-300 ease-out ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <h3
          id="end-sheet-title"
          className="m-0 mb-1 text-center text-[17px] font-bold leading-snug text-gray-900"
        >
          통화를 종료할까요?
        </h3>
        <p className="m-0 mb-4 text-center text-[13px] font-medium leading-relaxed text-gray-600">
          종료하면 AI 피드백 리포트가 생성돼요
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onKeep}
            className="flex-1 rounded-2xl bg-gray-100 py-3.5 text-[15px] font-bold leading-none tracking-[-0.01em] text-gray-800 active:scale-[0.98]"
          >
            계속하기
          </button>
          <button
            type="button"
            onClick={onEnd}
            className="flex-1 rounded-2xl bg-coral-500 py-3.5 text-[15px] font-bold leading-none tracking-[-0.01em] text-white active:scale-[0.98]"
          >
            종료하기
          </button>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm run test:run -- src/pages/call/EndConfirmSheet.test.tsx`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/pages/call/EndConfirmSheet.tsx src/pages/call/EndConfirmSheet.test.tsx
git commit -m "feat(call): add EndConfirmSheet bottom sheet"
```

---

## Task 9: pages/call/CallPage

`useCallSession` 결과로 status별 분기. mute/end 와이어링. status==='ended' 시 메인으로 navigate.

**Files:**
- Create: `src/pages/call/CallPage.tsx`
- Create: `src/pages/call/CallPage.test.tsx`

- [ ] **Step 1: 실패 테스트 작성**

`src/pages/call/CallPage.test.tsx`:

```tsx
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestQueryClient } from "../../../test/utils/renderWithQueryClient";
import { CallPage } from "./CallPage";

const sessionState = {
  status: "connecting" as
    | "connecting"
    | "connected"
    | "ended"
    | "error",
  errorMessage: null as string | null,
  isMuted: false,
  toggleMute: vi.fn(),
  end: vi.fn(),
  remoteAudioRef: createRef<HTMLAudioElement>(),
};

vi.mock("@/domains/call/hooks/useCallSession", () => ({
  useCallSession: () => sessionState,
}));

beforeEach(() => {
  sessionState.status = "connecting";
  sessionState.errorMessage = null;
  sessionState.isMuted = false;
  sessionState.toggleMute = vi.fn();
  sessionState.end = vi.fn();
});

afterEach(() => vi.clearAllMocks());

const renderAt = (path: string, state?: { partnerId?: number }) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter
        initialEntries={[{ pathname: path, state: state ?? null }]}
      >
        <Routes>
          <Route path="/call/:roomId" element={<CallPage />} />
          <Route path="/" element={<div>홈입니다</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe("CallPage", () => {
  it("roomId 또는 partnerId 가 없으면 / 로 리다이렉트한다", () => {
    renderAt("/call/abc");
    expect(screen.getByText("홈입니다")).toBeInTheDocument();
  });

  it("connecting 상태에서는 '연결 중' 라벨을 보여준다", () => {
    sessionState.status = "connecting";
    renderAt("/call/abc", { partnerId: 2 });

    expect(screen.getByText(/연결 중/)).toBeInTheDocument();
  });

  it("connected 상태에서는 타이머와 mute/speaker/end 버튼을 보여준다", () => {
    sessionState.status = "connected";
    renderAt("/call/abc", { partnerId: 2 });

    expect(screen.getByText("00:00")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "음소거" }),
    ).toBeEnabled();
    expect(screen.getByRole("button", { name: "스피커" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "통화 종료" }),
    ).toBeInTheDocument();
  });

  it("mute 버튼 클릭 시 toggleMute 가 호출된다", async () => {
    sessionState.status = "connected";
    renderAt("/call/abc", { partnerId: 2 });
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "음소거" }));

    expect(sessionState.toggleMute).toHaveBeenCalledOnce();
  });

  it("end 버튼 클릭 → 시트 노출 → '종료하기' → session.end() 호출", async () => {
    sessionState.status = "connected";
    renderAt("/call/abc", { partnerId: 2 });
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "통화 종료" }));
    expect(
      screen.getByRole("dialog", { name: "통화를 종료할까요?" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "종료하기" }));

    expect(sessionState.end).toHaveBeenCalledOnce();
  });

  it("status='ended' 면 / 로 redirect 한다", async () => {
    sessionState.status = "ended";
    renderAt("/call/abc", { partnerId: 2 });

    await waitFor(() =>
      expect(screen.getByText("홈입니다")).toBeInTheDocument(),
    );
  });

  it("status='error' 면 errorMessage 와 '메인으로' 버튼을 보여준다", async () => {
    sessionState.status = "error";
    sessionState.errorMessage = "마이크 권한이 필요해요";
    renderAt("/call/abc", { partnerId: 2 });

    expect(screen.getByText("마이크 권한이 필요해요")).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "메인으로" }));

    await waitFor(() =>
      expect(screen.getByText("홈입니다")).toBeInTheDocument(),
    );
  });
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `npm run test:run -- src/pages/call/CallPage.test.tsx`
Expected: FAIL.

- [ ] **Step 3: `CallPage.tsx` 구현**

`src/pages/call/CallPage.tsx`:

```tsx
import { useEffect, useState } from "react";
import {
  Navigate,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import { env } from "@/config/env";
import { useCallSession } from "@/domains/call/hooks/useCallSession";
import { CallTimer } from "./CallTimer";
import { EndConfirmSheet } from "./EndConfirmSheet";

export function CallPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const partnerId = (useLocation().state as { partnerId?: number } | null)
    ?.partnerId;

  if (!roomId || partnerId == null) {
    return <Navigate to="/" replace />;
  }

  return (
    <CallPageInner roomId={roomId} partnerId={partnerId} />
  );
}

function CallPageInner({
  roomId,
  partnerId,
}: {
  roomId: string;
  partnerId: number;
}) {
  const userId = env.devUserId;
  const navigate = useNavigate();
  const session = useCallSession({ userId, roomId, partnerId });
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    if (session.status === "ended") navigate("/", { replace: true });
  }, [session.status, navigate]);

  return (
    <div className="viewport flex min-h-dvh items-center justify-center bg-[#E7EAEE] p-6">
      <div className="phone relative h-[812px] w-[375px] overflow-hidden rounded-[44px] bg-white shadow-[0_0_0_10px_#1A1D22,0_30px_60px_rgba(0,0,0,0.25)] md:h-dvh md:w-full md:rounded-none md:shadow-none">
        <header className="relative z-10 flex h-11 items-center justify-between bg-white px-6 text-[15px] font-semibold text-gray-900">
          <span>9:41</span>
        </header>
        <main className="relative flex h-[calc(100%-44px)] flex-col overflow-hidden bg-gradient-to-b from-mint-50 to-white">
          {/* 항상 마운트되는 remote audio — status 분기 밖 */}
          <audio ref={session.remoteAudioRef} autoPlay className="hidden" />

          {session.status === "error" ? (
            <ErrorView message={session.errorMessage} onHome={() => navigate("/")} />
          ) : (
            <CallView
              status={session.status}
              isMuted={session.isMuted}
              onMute={session.toggleMute}
              onEnd={() => setSheetOpen(true)}
              partnerId={partnerId}
            />
          )}

          <EndConfirmSheet
            open={sheetOpen}
            onKeep={() => setSheetOpen(false)}
            onEnd={() => {
              setSheetOpen(false);
              session.end();
            }}
          />
        </main>
      </div>
    </div>
  );
}

function CallView({
  status,
  isMuted,
  onMute,
  onEnd,
  partnerId,
}: {
  status: "connecting" | "connected" | "ended";
  isMuted: boolean;
  onMute: () => void;
  onEnd: () => void;
  partnerId: number;
}) {
  return (
    <>
      <div className="relative z-[2] flex flex-col items-center gap-2 px-5 pt-4">
        <CallTimer active={status === "connected"} />
        <p className="m-0 text-[13px] font-medium text-gray-600">
          {status === "connecting"
            ? "연결 중…"
            : `상대 #${partnerId}`}
        </p>
      </div>

      <section className="relative z-[1] flex flex-1 flex-col items-center justify-center px-6">
        <div className="relative mb-6 flex h-60 w-60 items-center justify-center">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(31,191,146,0.18)_0%,rgba(31,191,146,0)_70%)] animate-halo"
          />
          <div className="relative flex h-40 w-40 items-center justify-center overflow-hidden rounded-full border-[3px] border-white bg-gradient-to-br from-mint-300 via-mint-500 to-coral-500 text-white shadow-orb">
            <span className="select-none text-[56px] font-bold tracking-[-0.02em] text-white">
              {String(partnerId).slice(-1)}
            </span>
          </div>
        </div>
      </section>

      <div className="relative z-[2] flex items-center justify-center gap-7 px-6 pb-9 pt-2">
        <button
          type="button"
          aria-label="음소거"
          onClick={onMute}
          className={`flex h-16 w-16 items-center justify-center rounded-full bg-white text-gray-800 shadow-ctrl transition active:scale-95 ${
            isMuted ? "bg-gray-900 text-white" : ""
          }`}
        >
          <MicIcon />
        </button>
        <button
          type="button"
          aria-label="스피커"
          disabled
          className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-gray-400 shadow-ctrl"
          title="추후 지원 예정"
        >
          <SpeakerIcon />
        </button>
        <button
          type="button"
          aria-label="통화 종료"
          onClick={onEnd}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-coral-500 text-white shadow-end transition active:scale-95"
        >
          <EndIcon />
        </button>
      </div>
    </>
  );
}

function ErrorView({
  message,
  onHome,
}: {
  message: string | null;
  onHome: () => void;
}) {
  return (
    <div className="relative z-[1] flex flex-1 flex-col items-center justify-center gap-4 px-6">
      <p className="m-0 text-[15px] font-medium text-gray-700">
        {message ?? "통화 연결에 실패했어요"}
      </p>
      <button
        type="button"
        onClick={onHome}
        className="rounded-md border border-gray-300 px-5 py-2.5 text-[14px] font-semibold text-gray-700"
      >
        메인으로
      </button>
    </div>
  );
}

function MicIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <path d="M12 19v3" />
    </svg>
  );
}

function SpeakerIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11 5 6 9H2v6h4l5 4V5Z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18.5 5.5a9 9 0 0 1 0 13" />
    </svg>
  );
}

function EndIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <g transform="rotate(135 12 12)">
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.72 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0 1 22 16.92z" />
      </g>
    </svg>
  );
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm run test:run -- src/pages/call/CallPage.test.tsx`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/pages/call/CallPage.tsx src/pages/call/CallPage.test.tsx
git commit -m "feat(call): add CallPage with status-based UI branches"
```

---

## Task 10: MatchingStatus 타입에 roomId 추가 + 핸들러/테스트 보강

**Files:**
- Modify: `src/domains/matching/types.ts`
- Modify: `src/mocks/handlers.ts`
- Modify: `src/domains/matching/hooks/useMatchingStatus.test.tsx`
- Modify: `src/domains/matching/api/matchingApi.test.ts`

- [ ] **Step 1: 타입 변경**

`src/domains/matching/types.ts`:

```ts
export type MatchStatus = "MATCHED" | "WAITING" | "NONE";

export type MatchingStatus = {
  status: MatchStatus;
  partnerId: number | null;
  roomId: string | null;
};
```

- [ ] **Step 2: typecheck 실행 → 테스트 mock 의 mismatch 가 노출됨**

Run: `npm run typecheck`
Expected: `useMatchingStatus.test.tsx` / `matchingApi.test.ts` / `MatchingPage.test.tsx` / `handlers.ts` 등에서 `roomId` 누락 에러.

- [ ] **Step 3: MSW 핸들러 보강**

`src/mocks/handlers.ts`의 `GET /users/:userId/matching` 응답을 다음으로 교체:

```ts
http.get(`${env.apiBaseUrl}/users/:userId/matching`, () => {
  return HttpResponse.json({
    data: { status: "WAITING", partnerId: null, roomId: null },
    status: 200,
    message: "OK",
  });
}),
```

- [ ] **Step 4: useMatchingStatus 테스트 보강**

`src/domains/matching/hooks/useMatchingStatus.test.tsx`의 4개 mock 응답에 `roomId` 필드 추가:

- "enabled=false 면 호출하지 않는다" (~line 28): `data: { status: "WAITING", partnerId: null, roomId: null }`
- "enabled=true 면 WAITING 데이터를 반환한다" (~line 48 `expect(...).toEqual(...)`): `{ status: "WAITING", partnerId: null, roomId: null }`
- "MATCHED 응답을 받으면 폴링이 멈춘다" (~line 60): `data: { status: "MATCHED", partnerId: 2, roomId: "11111111-1111-1111-1111-111111111111" }`
- "WAITING 응답이면 3초 후 다시 폴링한다" (~line 89): `data: { status: "WAITING", partnerId: null, roomId: null }`

- [ ] **Step 5: matchingApi 테스트 보강**

`src/domains/matching/api/matchingApi.test.ts`의 3곳 변경 (line 번호는 현재 시점 기준):

- line ~38: `expect(result).toEqual({ status: "WAITING", partnerId: null })` → `{ status: "WAITING", partnerId: null, roomId: null }`
- line ~45 (mock data) + line ~53 (expect): `{ status: "MATCHED", partnerId: 42 }` → `{ status: "MATCHED", partnerId: 42, roomId: "11111111-1111-1111-1111-111111111111" }`
- line ~60 (mock data): `{ status: "NONE", partnerId: null }` → `{ status: "NONE", partnerId: null, roomId: null }`

추가로 `src/pages/matching/MatchingPage.test.tsx`의 line ~246 (폴링 테스트)에서도 mock 응답에 `roomId: null` 추가.

- [ ] **Step 6: 테스트 통과 확인**

Run: `npm run typecheck && npm run test:run`
Expected: 전체 PASS.

- [ ] **Step 7: 커밋**

```bash
git add src/domains/matching/types.ts src/mocks/handlers.ts src/domains/matching/hooks/useMatchingStatus.test.tsx src/domains/matching/api/matchingApi.test.ts
git commit -m "feat(matching): add roomId to MatchingStatus and update mocks/tests"
```

---

## Task 11: MatchingPage MATCHED → /call navigate

`MATCHED` 응답을 받으면 `/call/:roomId` 로 navigate, 기존 cleanup 의 cancelMatchingQueue 는 호출되지 않도록 가드 해제.

**Files:**
- Modify: `src/pages/matching/MatchingPage.tsx`
- Modify: `src/pages/matching/MatchingPage.test.tsx`

- [ ] **Step 1: 실패 테스트 작성**

기존 `MatchingPage.test.tsx`는 이미 `Routes`, `Route`, `useLocation` 사용 가능하도록 import 가 갖춰져 있다. `react-router-dom`의 `useLocation`을 import 에 추가 (없으면):

```tsx
import { Route, Routes, useLocation } from "react-router-dom";
```

`describe` 블록 내부에 새 케이스 2개 추가:

```tsx
it("MATCHED 응답을 받으면 /call/:roomId 로 navigate 하고 partnerId 를 state 로 넘긴다", async () => {
  server.use(
    http.get("http://localhost:3000/users/1/matching", () =>
      HttpResponse.json({
        data: {
          status: "MATCHED",
          partnerId: 2,
          roomId: "11111111-1111-1111-1111-111111111111",
        },
        status: 200,
        message: "OK",
      }),
    ),
  );

  let capturedPartnerId: number | undefined;
  function CallStub() {
    const state = useLocation().state as { partnerId?: number } | null;
    if (state?.partnerId != null) capturedPartnerId = state.partnerId;
    return <div>통화 화면 stub</div>;
  }

  renderWithQueryClient(
    <Routes>
      <Route path="/" element={<MatchingPage />} />
      <Route path="/call/:roomId" element={<CallStub />} />
    </Routes>,
  );

  await waitFor(() =>
    expect(screen.getByText("통화 화면 stub")).toBeInTheDocument(),
  );
  expect(capturedPartnerId).toBe(2);
});

it("MATCHED 후 navigate 시에는 cancelMatchingQueue 가 호출되지 않는다", async () => {
  let deleteCount = 0;
  server.use(
    http.get("http://localhost:3000/users/1/matching", () =>
      HttpResponse.json({
        data: {
          status: "MATCHED",
          partnerId: 2,
          roomId: "11111111-1111-1111-1111-111111111111",
        },
        status: 200,
        message: "OK",
      }),
    ),
    http.delete("http://localhost:3000/users/1/matching", () => {
      deleteCount++;
      return HttpResponse.json({
        data: null,
        status: 204,
        message: "NO_CONTENT",
      });
    }),
  );

  renderWithQueryClient(
    <Routes>
      <Route path="/" element={<MatchingPage />} />
      <Route path="/call/:roomId" element={<div>통화 화면 stub</div>} />
    </Routes>,
  );

  await waitFor(() =>
    expect(screen.getByText("통화 화면 stub")).toBeInTheDocument(),
  );
  await new Promise((r) => setTimeout(r, 50));
  expect(deleteCount).toBe(0);
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `npm run test:run -- src/pages/matching/MatchingPage.test.tsx`
Expected: 새 케이스 2개 FAIL.

- [ ] **Step 3: `MatchingPage.tsx` 변경**

`src/pages/matching/MatchingPage.tsx`의 `useMatchingStatus` 호출과 useEffect 사이에 다음 로직을 추가. 기존 `useMatchingStatus(userId, enter.isSuccess)` 호출은 `const status = useMatchingStatus(userId, enter.isSuccess)` 로 받아둔 뒤:

```tsx
// 기존 컴포넌트 내부에 추가
useEffect(() => {
  const data = status.data;
  if (data?.status !== "MATCHED") return;
  if (!data.roomId || data.partnerId == null) return;
  enteredRef.current = false;
  navigate(`/call/${data.roomId}`, {
    state: { partnerId: data.partnerId },
    replace: true,
  });
}, [status.data, navigate]);
```

기존 `useMatchingStatus(userId, enter.isSuccess);` (반환값 미사용) 라인을 `const status = useMatchingStatus(userId, enter.isSuccess);` 로 변경.

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm run test:run -- src/pages/matching/MatchingPage.test.tsx`
Expected: 모든 케이스 PASS (기존 + 신규 2개).

- [ ] **Step 5: 커밋**

```bash
git add src/pages/matching/MatchingPage.tsx src/pages/matching/MatchingPage.test.tsx
git commit -m "feat(matching): navigate to /call/:roomId on MATCHED status"
```

---

## Task 12: App.tsx 라우트 추가

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: 라우트 추가**

`src/App.tsx`:

```tsx
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { QueryProvider } from "@/providers/QueryProvider";
import { MainPage } from "@/pages/main/MainPage";
import { MatchingPage } from "@/pages/matching/MatchingPage";
import { CallPage } from "@/pages/call/CallPage";
import { MyPagePage } from "@/pages/mypage/MyPagePage";
import { UserExpressionsPage } from "@/pages/userExpressions/UserExpressionsPage";
import { CallHistoryPage } from "@/pages/callHistory/CallHistoryPage";

export default function App() {
  return (
    <QueryProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<MainPage />} />
          <Route path="/matching" element={<MatchingPage />} />
          <Route path="/call/:roomId" element={<CallPage />} />
          <Route path="/mypage" element={<MyPagePage />} />
          <Route path="/expressions" element={<UserExpressionsPage />} />
          <Route path="/history" element={<CallHistoryPage />} />
        </Routes>
      </BrowserRouter>
    </QueryProvider>
  );
}
```

- [ ] **Step 2: typecheck 통과 확인**

Run: `npm run typecheck`
Expected: 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add src/App.tsx
git commit -m "feat(routing): mount CallPage at /call/:roomId"
```

---

## Task 13: 최종 검증

전체 테스트·타입체크·린트·커버리지 확인.

- [ ] **Step 1: typecheck**

Run: `npm run typecheck`
Expected: 에러 없음.

- [ ] **Step 2: lint**

Run: `npm run lint`
Expected: 경고 없음.

- [ ] **Step 3: 전체 테스트 실행**

Run: `npm run test:run`
Expected: 모든 테스트 PASS.

- [ ] **Step 4: 커버리지 확인**

Run: `npm run coverage`
Expected: lines/functions/branches/statements 모두 80% 이상.

- [ ] **Step 5: dev 서버 sanity check**

Run: `npm run dev`
- 브라우저에서 `/` 진입 → 메인 페이지 정상 렌더 확인
- 일단 라우팅 sanity 만 확인 (실제 통화 e2e 검증은 BE/시그널링 서버가 필요하므로 spec의 verification 섹션 따라 별도 진행)

- [ ] **Step 6: PR 생성 (선택)**

`/github-pr` 스킬 또는 수동으로 `feat/#23-voice-p2p-connection → dev` PR 생성.
