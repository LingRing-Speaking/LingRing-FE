# 음성 P2P 통화 연결 설계 (Voice P2P Connection Design)

- 작성일: 2026-04-29
- 상태: 승인 대기
- 이슈: [#23 feat: WebRTC 음성 P2P 연결 구현](https://github.com/LingRing-Speaking/LingRing-FE/issues/23)
- 선행 작업:
  - `2026-04-29-matching-queue-integration-design.md` (매칭 큐 입장/폴링)
  - `2026-04-28-matching-page-design.md` (매칭 페이지 UI)
- 대응 백엔드 명세:
  - Notion "WebSocket Signaling" — `ws://<host>/ws/signaling?userId=&roomId=`, JSON wire format, JOIN/READY/OFFER/ANSWER/ICE_CANDIDATE/HANGUP/ERROR 메시지 타입
  - `MatchingStatusResponse(MatchingPollStatus status, Long partnerId, UUID roomId)` — 부모 API Endpoint Notion 페이지는 미업데이트 상태이나 BE 코드상 `roomId` 필드 존재 확인됨

## 1. 목표와 범위

### 목표
- 매칭 성공(`MATCHED`) 후 양측 클라이언트가 시그널링 서버를 거쳐 SDP/ICE를 교환하고, 브라우저 네이티브 WebRTC로 1:1 음성 P2P 연결을 수립한다.
- 사용자가 종료하거나 상대가 종료하면 즉시 정리되고 메인으로 복귀한다.
- 마이크 권한 거부 / 시그널링 실패 / ICE 실패 같은 에러를 사용자가 이해할 수 있는 형태로 노출한다.

### 범위 안
- 신규 도메인 `src/domains/call/` — 시그널링 클라이언트, WebRTC 피어 헬퍼, 오케스트레이터 hook
- `src/pages/call/` — `lingring_call.html` 목업 기반 Mock UI (타이머, 프로필, mute, end 확인 시트)
- `src/App.tsx` — `/call/:roomId` 라우트
- `src/pages/matching/MatchingPage.tsx` — `MATCHED` 수신 시 `/call/:roomId`로 자동 navigate
- `src/domains/matching/types.ts` — `MatchingStatus`에 `roomId` 추가
- `src/config/env.ts` — `wsBaseUrl` 추가
- `src/mocks/handlers.ts` — matching 응답에 `roomId` 필드 보강
- 위 모든 코드의 단위/통합 테스트 (커버리지 80%+ 유지)

### 범위 밖
- **스피커 전환**: Capacitor 플러그인 필요 — 이번 PR은 disabled 버튼으로 자리만 확보, TODO 주석 + 후속 PR
- **녹음 indicator**: BE 녹음 시그널 미정 — 이번 PR 렌더링 X
- **AI 피드백 리포트 화면**: 통화 종료 후 메인으로 복귀만, 리포트 화면은 후속 작업
- **재접속 / 자동 재시도**: 스펙대로 끊기면 매칭부터 재시작
- **MSW WebSocket 모킹**: WS는 직접 mock 클래스 주입으로 단위 테스트 (브라우저 mock과 결이 다름)
- **신고/차단 페이지** (#16) — 별도 PR

## 2. 사용자 흐름

```
[매칭]                                    [통화]                                       [메인]
 폴링 GET /matching
   │
   └─ MATCHED + roomId + partnerId
        │
        └─navigate(/call/:roomId, state:{partnerId}, replace)─▶  마운트
                                                                  │
                                                                  ▼
                                                          getUserMedia(audio)
                                                                  │
                                                                  ▼
                                                       WS connect (ws://host/ws/signaling)
                                                                  │
                                                                  ▼
                                                              send JOIN
                                                                  │
                                                                  ▼
                                                          READY 수신
                                                          ┌───────┴───────┐
                                                       caller=self     caller=other
                                                          │                │
                                                       OFFER 송신       OFFER 대기
                                                          │                │
                                                       ANSWER 수신     ANSWER 송신
                                                          └───────┬───────┘
                                                                  ▼
                                                       ICE_CANDIDATE 양방향
                                                                  ▼
                                                       pc.connectionState="connected"
                                                                  ▼
                                                          [통화 중 — 음성 P2P]
                                                                  │
                                  ┌────────── end 버튼 / HANGUP 수신 / WS close / 에러 ─────┐
                                  ▼                                                         │
                          send HANGUP (사용자 end만)                                          │
                          mic stop → pc close → WS close                                    │
                                  │                                                         │
                                  └─navigate("/", replace)───────────────────────────────▶
```

## 3. 아키텍처

### 디렉토리 구조

```
src/domains/call/                          # 신규 도메인
  signaling/
    types.ts                               # ClientMessage / ServerMessage union
    wsClient.ts                            # 순수 WebSocket 래퍼
    wsClient.test.ts
  webrtc/
    peerConnection.ts                      # RTCPeerConnection + getUserMedia 헬퍼
    peerConnection.test.ts
  hooks/
    useCallSession.ts                      # 오케스트레이터 hook (signaling + peer 결합)
    useCallSession.test.tsx

src/pages/call/                            # 신규 페이지
  CallPage.tsx
  CallPage.test.tsx
  EndConfirmSheet.tsx                      # MatchingPage의 CancelConfirmSheet 패턴 그대로
  EndConfirmSheet.test.tsx
  CallTimer.tsx                            # MM:SS 타이머
  CallTimer.test.tsx

src/domains/matching/types.ts              # ← roomId 추가
src/mocks/handlers.ts                      # ← matching 응답에 roomId
src/pages/matching/MatchingPage.tsx        # ← MATCHED → navigate 추가
src/pages/matching/MatchingPage.test.tsx   # ← 케이스 추가
src/domains/matching/hooks/useMatchingStatus.test.tsx  # ← mock 보강
src/App.tsx                                # ← /call/:roomId 라우트
src/config/env.ts                          # ← wsBaseUrl 추가
test/setup.ts                              # ← RTCPeerConnection fake, getUserMedia mock
```

### 설계 원칙

- **레이어 분리** (`cohesion.md`): 시그널링(WS) ↔ WebRTC(피어) ↔ 오케스트레이터(상태머신) 각각 단일 책임. 단위 테스트 단독 가능.
- **외부 의존성 주입** (`predictability.md`): `wsClient`는 `WebSocket` 생성자를 옵션으로 주입 가능, `peerConnection`은 `RTCPeerConnection` 생성자/`getUserMedia` 함수를 `globalThis`에서 가져오되 테스트 setup에서 fake로 대체.
- **사이드이펙트는 cleanup으로 회수** (`coupling.md`): 오케스트레이터 hook의 cleanup이 멱등하게 mic stop → pc close → WS close 순서로 해제.
- **상수는 사용처 옆에** (`cohesion.md`): ICE 서버 설정, 메시지 타입 상수 등은 사용 파일 내부에 둔다.

## 4. 시그널링 모듈

### `signaling/types.ts`

Notion wire format 1:1 매핑. discriminated union으로 타입 안전.

```ts
export type ClientMessage =
  | { type: "JOIN" }
  | { type: "OFFER"; payload: { sdp: string } }
  | { type: "ANSWER"; payload: { sdp: string } }
  | {
      type: "ICE_CANDIDATE";
      payload: {
        candidate: string;
        sdpMid: string | null;
        sdpMLineIndex: number | null;
      };
    }
  | { type: "HANGUP" };

export type ServerMessage =
  | {
      type: "READY";
      fromUserId: number;
      toUserId: number;
      payload: { callerUserId: number; calleeUserId: number };
    }
  | {
      type: "OFFER" | "ANSWER";
      fromUserId: number;
      toUserId: number;
      payload: { sdp: string };
    }
  | {
      type: "ICE_CANDIDATE";
      fromUserId: number;
      toUserId: number;
      payload: {
        candidate: string;
        sdpMid: string | null;
        sdpMLineIndex: number | null;
      };
    }
  | {
      type: "HANGUP";
      fromUserId: number | null;
      toUserId: number | null;
      payload: null;
    }
  | { type: "ERROR"; payload: { code: string; message: string } };
```

> **주의**: 클라이언트 송신 메시지에는 `fromUserId`/`toUserId`/`roomId` 필드를 포함하지 않는다 — 서버가 핸드셰이크 시점의 세션 attribute에서 채운다 (Notion 스펙).

### `signaling/wsClient.ts`

```ts
export type SignalingClient = {
  send: (msg: ClientMessage) => void;
  onMessage: (handler: (msg: ServerMessage) => void) => () => void;
  onClose: (handler: (e: CloseEvent) => void) => () => void;
  close: () => void;
};

export function createSignalingClient(
  opts: { userId: number; roomId: string; baseUrl: string },
  deps: { WebSocketCtor?: typeof WebSocket } = {},
): SignalingClient {
  const Ctor = deps.WebSocketCtor ?? WebSocket;
  const url = `${opts.baseUrl}/ws/signaling?userId=${opts.userId}&roomId=${encodeURIComponent(opts.roomId)}`;
  const ws = new Ctor(url);
  // 메시지 핸들러 set, JSON 직렬화/역직렬화, unsubscribe 반환
  // ...
}
```

- URL 구성: `baseUrl`은 `env.wsBaseUrl` (예: `wss://api.lingring.example`).
- `send`는 `JSON.stringify(msg)`. WS가 아직 OPEN 아니면 내부 큐에 쌓고 open 시 flush (단순 구현 — 큐 크기 제한 없음).
- `onMessage`는 `JSON.parse` + 핸들러 호출. 파싱 실패는 console에 warning만 (스펙 외 메시지는 무시).
- 핸들러 등록은 Set 자료구조로 관리, unsubscribe 함수 반환.
- 비즈니스 로직(상태 머신, peer 연동)은 들어가지 않음.

### `wsClient` 테스트 핵심
- URL 구성 (스킴/userId/roomId)
- `send` → fake WS의 `send`에 직렬화된 JSON 전달
- WS가 OPEN 전 send → 큐에 쌓임 → open 후 flush
- 수신 → 등록된 모든 핸들러에 파싱된 메시지 전달
- `onMessage` unsubscribe → 이후 메시지에는 핸들러 호출 안 됨
- `onClose` 핸들러 호출
- `close` 호출 시 fake WS의 `close` 호출 + 이후 send 무시 (또는 throw — 테스트로 확정)

## 5. WebRTC 모듈

### `webrtc/peerConnection.ts`

```ts
const ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];

export type IceCandidatePayload = {
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number | null;
};

export type PeerSession = {
  start: () => Promise<void>;
  createOffer: () => Promise<string>;
  acceptOffer: (remoteSdp: string) => Promise<string>;
  acceptAnswer: (remoteSdp: string) => Promise<void>;
  addRemoteIce: (c: IceCandidatePayload) => Promise<void>;
  setMicEnabled: (enabled: boolean) => void;
  close: () => void;
};

export function createPeerSession(opts: {
  onLocalIce: (c: IceCandidatePayload) => void;
  onRemoteTrack: (stream: MediaStream) => void;
  onConnectionStateChange: (state: RTCPeerConnectionState) => void;
}): PeerSession {
  // 내부 상태: pc, localStream, pendingIce: IceCandidatePayload[]
  // ...
}
```

- `start()`: `navigator.mediaDevices.getUserMedia({ audio: true })` → 트랙을 `pc`에 add.
- `pc.onicecandidate` → `event.candidate`을 `IceCandidatePayload`로 변환해 `onLocalIce` 콜백.
- `pc.ontrack` → `event.streams[0]` → `onRemoteTrack` 콜백.
- `pc.onconnectionstatechange` → `pc.connectionState`을 콜백 전달.
- `addRemoteIce(c)`: `pc.remoteDescription` 없으면 `pendingIce`에 push. 있으면 즉시 `pc.addIceCandidate(new RTCIceCandidate(c))`.
- `acceptOffer`/`acceptAnswer` 직후 `pendingIce` flush.
- `setMicEnabled(false)`: `localStream.getAudioTracks().forEach(t => t.enabled = false)` (트랙 자체는 살아있음).
- `close()`: `localStream.getTracks().forEach(t => t.stop())` → `pc.close()`. 멱등 (이미 close 시 no-op).

> **ICE 서버**: STUN만 사용. TURN은 BE/인프라에서 결정 후 추가 (현재 스펙에 명시 없음 → YAGNI).

### `peerConnection` 테스트 핵심
- `RTCPeerConnection` fake 클래스 + `getUserMedia` mock을 `test/setup.ts`에 전역 주입
- `start()` → `getUserMedia` 호출 + 트랙이 `pc.addTrack`에 전달
- `createOffer()` → fake pc의 `createOffer` + `setLocalDescription` + sdp 반환
- `acceptOffer(sdp)` → `setRemoteDescription` → `createAnswer` → `setLocalDescription` → answer sdp 반환
- `acceptAnswer(sdp)` → `setRemoteDescription`
- `addRemoteIce` 버퍼링: `acceptOffer` 전에 `addRemoteIce` 호출 → `pendingIce` push, `acceptOffer` 후 flush 검증
- `setMicEnabled(false)` → 모든 audio track의 `enabled = false`
- `close()` → 모든 track stop + pc close, 두 번 호출해도 안전
- 콜백: `onLocalIce`, `onRemoteTrack`, `onConnectionStateChange` 트리거

## 6. 오케스트레이터 hook

### `hooks/useCallSession.ts`

```ts
export type CallStatus = "connecting" | "connected" | "ended" | "error";

export function useCallSession(opts: {
  userId: number;
  roomId: string;
  partnerId: number;
}): {
  status: CallStatus;
  errorMessage: string | null;
  isMuted: boolean;
  toggleMute: () => void;
  end: () => void;
  remoteAudioRef: React.RefObject<HTMLAudioElement>;
};
```

### 내부 동작

마운트 시 1회 실행:

```
1. peer = createPeerSession({
     onLocalIce: (c) => ws.send({ type:"ICE_CANDIDATE", payload:c }),
     onRemoteTrack: (stream) => { remoteAudioRef.current.srcObject = stream; remoteAudioRef.current.play(); },
     onConnectionStateChange: (s) => {
       if (s === "connected") setStatus("connected");
       if (s === "failed") setError("통화 연결에 실패했어요");
     },
   })
2. await peer.start()  // 마이크 거부 시 catch → setError("마이크 권한이 필요해요")
3. ws = createSignalingClient({ userId, roomId, baseUrl: env.wsBaseUrl })
4. ws.onMessage(handle)
5. ws.onClose((e) => { if (status !== "ended") cleanup(); setStatus("ended"); })
6. (WS open 후) ws.send({ type:"JOIN" })
```

`handle(msg: ServerMessage)`:

```
switch msg.type
  READY:
    if (msg.payload.callerUserId === userId) {
      const sdp = await peer.createOffer()
      ws.send({ type:"OFFER", payload:{ sdp } })
    }
  OFFER:    // callee 경로
    const sdp = await peer.acceptOffer(msg.payload.sdp)
    ws.send({ type:"ANSWER", payload:{ sdp } })
  ANSWER:   // caller 경로
    await peer.acceptAnswer(msg.payload.sdp)
  ICE_CANDIDATE:
    await peer.addRemoteIce(msg.payload)
  HANGUP:
    cleanup(); setStatus("ended")
  ERROR:
    setError(msg.payload.message || "통화 연결에 실패했어요")
```

`end()`:
```
ws.send({ type:"HANGUP" })
cleanup(); setStatus("ended")
```

`cleanup()` (멱등, ref guard로 1회만):
```
peer.close()   // 내부에서 mic stop → pc close
ws.close()
```

### `useCallSession` 테스트 핵심

`signaling/wsClient`와 `webrtc/peerConnection`을 `vi.mock`으로 fake 주입.

- **caller 경로**: useEffect 실행 → `peer.start` resolved → ws "open" 시뮬 → JOIN 송신 검증 → READY(caller=self) 주입 → `createOffer` 호출 + OFFER 송신 → ANSWER 수신 → `acceptAnswer` 호출 → `onConnectionStateChange("connected")` → `status === "connected"`
- **callee 경로**: 동일 시작 → READY(caller=other) → OFFER 수신 → `acceptOffer` + ANSWER 송신 → ICE 양방향 → connected
- **HANGUP 수신**: HANGUP 메시지 주입 → cleanup 호출 + `status === "ended"` (HANGUP 재송신 X)
- **사용자 end**: `result.current.end()` 호출 → ws에 HANGUP 송신 + cleanup + `status === "ended"`
- **WS 비정상 close**: ws.onClose 콜백 강제 트리거 → cleanup + `status === "ended"` (HANGUP 재송신 X)
- **마이크 거부**: `peer.start` reject → `status === "error"`, message: "마이크 권한이 필요해요"
- **ERROR 수신**: ERROR 메시지 → `status === "error"`, message: payload.message
- **pc 'failed'**: `onConnectionStateChange("failed")` → `status === "error"`
- **toggleMute**: `peer.setMicEnabled` 호출 + `isMuted` 토글
- **unmount**: cleanup 호출 보장 (가드로 1회만)
- **ICE flow**: 로컬 ICE 발생 → `ws.send({ type:"ICE_CANDIDATE", payload })`, ICE_CANDIDATE 수신 → `peer.addRemoteIce`

## 7. CallPage / EndConfirmSheet / CallTimer

### `CallPage.tsx`

```tsx
const { roomId } = useParams<{ roomId: string }>();
const partnerId = (useLocation().state as { partnerId?: number } | null)?.partnerId;
const userId = env.devUserId;

if (!roomId || partnerId == null) {
  return <Navigate to="/" replace />;  // 직접 URL 진입 / 새로고침 방어
}

const session = useCallSession({ userId, roomId, partnerId });
const [sheetOpen, setSheetOpen] = useState(false);
const navigate = useNavigate();

useEffect(() => {
  if (session.status === "ended") navigate("/", { replace: true });
}, [session.status, navigate]);
```

UI 분기 (`predictability.md` 따라 IIFE 또는 분리 컴포넌트):

| status | 렌더 |
|---|---|
| `connecting` | 호흡 ring + "연결 중" 라벨 (matching의 `BreathingOrb` 패턴 응용 또는 단순 텍스트). 사용자 종료 가능 |
| `connected` | 타이머 + 프로필 + 음성 ring + mute/speaker(disabled)/end 버튼 |
| `error` | 메시지(`session.errorMessage`) + "메인으로" 버튼 (matching 에러 UI 패턴) |
| `ended` | 즉시 `/` redirect (위 useEffect) — 별도 렌더 없음 |

**오디오 엘리먼트는 status와 무관하게 항상 마운트**: `<audio ref={session.remoteAudioRef} autoPlay />`를 `connecting`/`connected` 양쪽에서 렌더(또는 status 분기 밖에서 한 번만 렌더)해야 한다. `connecting` 단계에서 remote track이 도착할 수 있고, 이때 ref가 null이면 콜백에서 `srcObject` 할당이 실패한다. 시각적으론 `<audio>`가 안 보이므로 분기 밖 단일 마운트가 가장 단순.

End 흐름:
- end 버튼 클릭 → `setSheetOpen(true)`
- 시트의 "종료하기" → `setSheetOpen(false); session.end()` → `status === "ended"` → useEffect로 navigate

### `EndConfirmSheet.tsx`

`pages/matching/CancelConfirmSheet.tsx` 1:1 패턴. 차이점:
- 헤드: "통화를 종료할까요?"
- 본문: "종료하면 AI 피드백 리포트가 생성돼요" (mockup 그대로 — 리포트 자체는 후속 PR이라 문구만)
- 버튼: "계속하기" (secondary), "종료하기" (primary, coral)

### `CallTimer.tsx`

```tsx
export function CallTimer({ active }: { active: boolean }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [active]);
  const m = String(Math.floor(seconds / 60)).padStart(2, "0");
  const s = String(seconds % 60).padStart(2, "0");
  return <span className="...">{m}:{s}</span>;
}
```

`active = (status === "connected")` — 연결되기 전엔 카운트 시작 안 함.

### Page 테스트 핵심

`useCallSession` 전체 mock:
- status별 렌더 분기
- end 버튼 → 시트 노출 → 종료하기 → `session.end()` 호출
- mute 버튼 → `session.toggleMute()` 호출 + active 클래스 토글
- speaker 버튼 disabled
- `status === "ended"` → `/` navigate (`replace: true`)
- `roomId`/`partnerId` 누락 시 `/`로 redirect

## 8. MatchingPage 전이

### 변경

```tsx
const status = useMatchingStatus(userId, enter.isSuccess);

useEffect(() => {
  const data = status.data;
  if (data?.status !== "MATCHED") return;
  if (!data.roomId || data.partnerId == null) return;  // 방어
  enteredRef.current = false;  // unmount cleanup의 cancelMatchingQueue 회피
  navigate(`/call/${data.roomId}`, {
    state: { partnerId: data.partnerId },
    replace: true,
  });
}, [status.data, navigate]);
```

`enteredRef.current = false` 의의: 매칭이 성공해서 통화 화면으로 떠나는 경우, BE는 이미 매치를 만들고 큐에서 제거했으므로 DELETE는 불필요. 명시적으로 가드 해제로 cancel을 막음.

### 변경된 테스트
- 기존 케이스의 status mock에 `roomId: null` 추가 (WAITING/NONE)
- 신규: status mock이 `MATCHED + roomId + partnerId` 응답 → `navigate("/call/<uuid>", { state:{partnerId}, replace:true })` 호출 검증
- 신규: 위 케이스에서 unmount 후 `cancelMatchingQueue` 호출 안 됐는지 검증

## 9. 환경 변수

`src/config/env.ts`:

```ts
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
// ...
export const env = {
  apiBaseUrl,
  wsBaseUrl: apiBaseUrl.replace(/^http/, "ws"),  // http→ws, https→wss
  devUserId: Number(devUserIdRaw),
};
```

별도 `VITE_WS_BASE_URL` 도입 X — BE가 같은 호스트에서 WS도 서빙하므로 단순 치환으로 충분 (YAGNI). 인프라가 분리되면 그때 별도 변수 추가.

## 10. test/setup.ts 추가

```ts
// RTCPeerConnection fake — jsdom에 없음
class FakeRTCPeerConnection {
  // setRemoteDescription, setLocalDescription, createOffer, createAnswer, addIceCandidate, addTrack, close
  // onicecandidate, ontrack, onconnectionstatechange
  // connectionState
}

globalThis.RTCPeerConnection = FakeRTCPeerConnection as unknown as typeof RTCPeerConnection;

// getUserMedia mock
Object.defineProperty(globalThis.navigator, "mediaDevices", {
  value: {
    getUserMedia: vi.fn().mockResolvedValue(/* fake MediaStream */),
  },
  configurable: true,
});
```

세부 fake 구현은 테스트에서 필요한 메서드 / 이벤트만 최소로 시뮬. 케이스별로 mock을 override.

## 11. 알려진 한계 / TODO

| 항목 | 처리 방식 |
|---|---|
| iOS WebView `<audio autoPlay>` 자동재생 정책 | 매칭 자동 navigation은 user gesture가 아님. Capacitor WebView가 보통 허용하지만 실기기 검증 필요. CallPage에 `play().catch()` 명시 + spec/주석에 known issue로 명시 |
| iOS 백그라운드 통화 유지 | `Info.plist UIBackgroundModes:audio` + `AppDelegate.configureAudioSessionForVoiceCall()` 에서 `AVAudioSession.playAndRecord/.voiceChat/.allowBluetooth` 설정으로 해결. JS 측 `useCallSession` visibilitychange 핸들러가 visible 복귀 시 `<audio>.play()` 안전망 호출, `CallTimer` 는 wallclock 기반으로 throttled timer 보정 |
| Android 백그라운드 통화 유지 | 별도 이슈로 분리. `FOREGROUND_SERVICE` + `FOREGROUND_SERVICE_MICROPHONE` 권한 + ForegroundService 클래스(또는 Capacitor 플러그인) + persistent 알림 필요 |
| 재접속 미지원 | 스펙 정책 — WS 비정상 close 시 매칭부터 재시작. CallPage error 화면 → 메인으로 |
| 스피커 전환 (iOS) | `ios/App/App/AudioRoutePlugin.swift` (in-app Capacitor plugin) + `src/lib/native/audioRoute.ts` 도입. `useCallSession.toggleSpeaker` 가 `AVAudioSession.overrideOutputAudioPort(.speaker / .none)` 호출. **iOS만 구현됨** — Android는 별도 이슈에서 동일 `AudioRoute` 인터페이스에 `AudioManager.setSpeakerphoneOn` 구현체 추가 |
| 녹음 indicator | BE 녹음 시그널 미정. 이번 PR 렌더링 X |
| TURN 서버 | 현재 STUN만 (Google). NAT 환경에 따라 연결 실패 가능. BE/인프라 결정 후 추가 |
| API Endpoint Notion 페이지 stale | `MatchingStatusResponse.roomId` 미반영. spec 작성 시점엔 BE 코드로 직접 확인 |

## 12. 검증

### 자동 테스트
```
npm run typecheck && npm run lint && npm run test:run && npm run coverage
```
커버리지 80%+ 유지 (CLAUDE.md 규칙).

### 로컬 e2e
- dev BE + signaling 서버 띄우기
- 두 시크릿 창에서 다른 `VITE_DEV_USER_ID`로 접근 → 매칭 → 자동 `/call/:roomId` 진입 → "연결 중" → "연결됨" + 타이머 → 한쪽 종료 시 양쪽 ended → 메인 복귀
- 마이크 권한 거부 → error UI 노출

### 시그널 검증 (브라우저 devtools)
- Network → WS 프레임에 JOIN/READY/OFFER/ANSWER/ICE_CANDIDATE/HANGUP 시퀀스 확인
- 양쪽 `pc.connectionState === "connected"` 도달

### iOS Capacitor 실기기
- `<audio autoPlay>` 자동재생 정책 통과 여부
- `Info.plist`의 `NSMicrophoneUsageDescription` 사전 추가 (네이티브 빌드 필요)
- 마이크 권한 프롬프트 정상 노출

### 코드 리뷰 체크리스트
- 시그널링 wire format(Notion) ↔ `signaling/types.ts` + 메시지 직렬화 1:1 일치
- cleanup 순서 (mic → pc → ws)와 멱등성
- ICE 버퍼링 동작
- HANGUP 송수신 후 메시지 전송 중단
- 알려진 한계 4개 모두 코드 TODO 또는 spec에 명시
