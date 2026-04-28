# 매칭 대기열 연동 설계 (Matching Queue Integration Design)

- 작성일: 2026-04-29
- 상태: 승인 대기
- 선행 작업: `2026-04-28-matching-page-design.md` (매칭 페이지 UI/아이스브레이커 연동)
- 대응 백엔드 API:
  - `POST /users/{userId}/matching` — 대기열 입장 (멱등, 204)
  - `GET /users/{userId}/matching` — 매칭 상태 조회 (200, 폴링용)
  - `DELETE /users/{userId}/matching` — 대기열 이탈 (멱등, 204)

## 1. 목표와 범위

### 목표
- 메인 페이지에서 통화 시작을 누르면 매칭 큐에 입장(POST)하고, 매칭 페이지에서 3초 주기로 상태를 폴링한다.
- 매칭 페이지를 떠나는 모든 경로에서 정확히 1회 큐에서 이탈(DELETE)한다.
- `MATCHED` 상태를 받으면 폴링을 자동으로 중지한다 (이후 후속 액션은 별도 작업).

### 범위 안
- 매칭 도메인 (`src/domains/matching/`) — types, API 호출, 입장 mutation 훅, 상태 폴링 query 훅
- HTTP 레이어 확장 — `httpPost` / `httpDelete` 추가
- `MatchingPage`에 입장(POST on mount) · 폴링 · 이탈(DELETE on unmount) 와이어링
- POST 실패 시 에러 UI (다시 시도 / 메인으로)
- 위 코드에 대응하는 단위 테스트 + MSW 핸들러

### 범위 밖
- `MATCHED` 수신 후 후속 동작 (통화 화면 진입, room id 처리, WebRTC 셋업 등)
- 매칭 취소를 별도 mutation 훅으로 노출 — 본 설계에서는 cleanup에서 API 함수 직접 호출
- 네이티브 종료(앱 백그라운드/강제 종료) 시 DELETE 보장 — 브라우저/Capacitor 라이프사이클 외 영역

## 2. 사용자 흐름

```
[메인]                         [매칭]                                          [메인]
 통화 버튼 ──navigate──▶  마운트 → POST /matching ──┐
                               (성공)              │
                                  ▼                │
                          GET /matching (3초 폴링) │
                            │                      │
                            ├─ WAITING/NONE → 계속 │
                            └─ MATCHED → 폴링 중지 │
                                                    │
                          ┌────────────────────────┘
                          │
                  [페이지 이탈 — 취소 시트의 "취소하기" 또는 라우터 변경]
                          │
                          ▼
                  unmount cleanup → DELETE /matching → /
```

1. 메인에서 통화 시작 클릭 → `/matching` navigate (`CallHero`는 변경 없음).
2. `MatchingPage` 마운트 시 `POST /users/{userId}/matching` 1회 송신.
3. POST 성공 후에만 폴링 활성화 — `GET /users/{userId}/matching` 3초 주기 호출.
4. 응답의 `status`에 따라:
   - `WAITING`, `NONE` → 그대로 대기 화면 유지, 계속 폴링.
   - `MATCHED` → 폴링 자동 중지. 화면은 그대로 유지 (후속 작업에서 다음 화면 전환).
5. 사용자가 닫기(✕) 또는 "매칭 취소" → 기존 `CancelConfirmSheet` 노출 → "취소하기" 누르면 `/`로 navigate.
6. 페이지 언마운트 시 (5의 경우 + 라우터에 의한 그 외 이탈 모두) cleanup이 `DELETE /users/{userId}/matching`을 fire-and-forget으로 송신.

## 3. 아키텍처

### 디렉토리 구조

```
src/lib/
  http.ts                              # ← httpPost, httpDelete 추가
  http.test.ts                         # ← 테스트 추가

src/domains/matching/                  # ← 신규 도메인
  types.ts
  api/
    matchingApi.ts
    matchingApi.test.ts
  hooks/
    useEnterMatchingQueue.ts
    useEnterMatchingQueue.test.tsx
    useMatchingStatus.ts
    useMatchingStatus.test.tsx

src/pages/matching/MatchingPage.tsx       # ← 와이어링 변경
src/pages/matching/MatchingPage.test.tsx  # ← 케이스 추가

test/msw/handlers.ts                   # ← matching 엔드포인트 3종 핸들러 추가
```

### 설계 원칙

- 매칭 큐 라이프사이클(입장·폴링·이탈)을 `MatchingPage` 한 곳에 응집 (`cohesion.md`).
- 훅은 책임별로 분리 — 입장 mutation, 상태 query 두 종류만 (`coupling.md`). 이탈은 cleanup에서 API 함수 직접 호출하므로 별도 훅 불필요.
- `cancelMatchingQueue` API 함수는 그대로 export 하되, 호출처는 cleanup 1곳.

## 4. HTTP 레이어 확장

`src/lib/http.ts`에 다음을 추가한다. 기존 `httpGet`과 동일한 envelope (`{ data, status, message }`) · 동일한 에러 처리 (`ApiError` throw).

```ts
export async function httpPost<T = void>(path: string): Promise<T> {
  const res = await fetch(`${env.apiBaseUrl}${path}`, { method: "POST" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      typeof body === "object" && body !== null && "message" in body
        ? String((body as { message: unknown }).message)
        : "Unknown error";
    throw new ApiError(res.status, message);
  }
  return (body as ApiResponse<T>).data;
}

export async function httpDelete<T = void>(path: string): Promise<T> {
  // method: "DELETE", 그 외 동일
}
```

- 이번 작업에선 POST 바디가 필요하지 않으므로 `httpPost(path)` 단일 시그니처로 충분 (YAGNI). 추후 바디가 필요한 호출이 생기면 그때 오버로드를 추가한다.
- 204 응답이라 `data: null`이 와도 안전하게 동작해야 한다 (`return null` 그대로 반환되어도 호출처가 `void`로 받으므로 무해).

## 5. 매칭 도메인

### `types.ts`

```ts
export type MatchStatus = "MATCHED" | "WAITING" | "NONE";

export type MatchingStatus = {
  status: MatchStatus;
  partnerId: number | null;
};
```

### `api/matchingApi.ts`

```ts
import { httpDelete, httpGet, httpPost } from "@/lib/http";
import type { MatchingStatus } from "../types";

const matchingPath = (userId: number) => `/users/${userId}/matching`;

export const enterMatchingQueue = (userId: number): Promise<void> =>
  httpPost(matchingPath(userId));

export const cancelMatchingQueue = (userId: number): Promise<void> =>
  httpDelete(matchingPath(userId));

export const fetchMatchingStatus = (userId: number): Promise<MatchingStatus> =>
  httpGet<MatchingStatus>(matchingPath(userId));
```

세 함수가 단일한 시그니처(`userId` 1개 인자)와 동일한 path 빌더를 공유 — `predictability.md`의 일관성.

### `hooks/useEnterMatchingQueue.ts`

```ts
import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { enterMatchingQueue } from "../api/matchingApi";

export function useEnterMatchingQueue(): UseMutationResult<
  void,
  Error,
  number
> {
  return useMutation({
    mutationFn: (userId: number) => enterMatchingQueue(userId),
  });
}
```

### `hooks/useMatchingStatus.ts` (3초 폴링 핵심)

```ts
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { fetchMatchingStatus } from "../api/matchingApi";
import type { MatchingStatus } from "../types";

const POLL_INTERVAL_MS = 3000;

export function useMatchingStatus(
  userId: number,
  enabled: boolean,
): UseQueryResult<MatchingStatus, Error> {
  return useQuery({
    queryKey: ["matching", "status", userId],
    queryFn: () => fetchMatchingStatus(userId),
    enabled,
    refetchInterval: (query) =>
      query.state.data?.status === "MATCHED" ? false : POLL_INTERVAL_MS,
    refetchOnMount: "always",
    gcTime: 0,
    staleTime: 0,
  });
}
```

- `enabled`로 POST 성공 이전 폴링 차단.
- `refetchInterval` 콜백으로 `MATCHED` 수신 시 자동 중지 (`WAITING`/`NONE`은 계속 폴링).
- `POLL_INTERVAL_MS`는 사용처와 같은 파일에 둠 (`cohesion.md`).

## 6. `MatchingPage` 와이어링

### 상태 머신

```
[mount]
   │
   ▼
[enter mutation 실행 (POST)]
   │
   ├─ pending  → 기존 BreathingOrb 화면 + 회전 카드 (UI는 그대로)
   ├─ error    → 에러 분기: "매칭을 시작할 수 없어요" + 다시 시도 / 메인으로
   └─ success  → 폴링 enabled = true, enteredRef.current = true
                   │
                   ▼
              [3초 주기 GET]
                   │
                   ├─ WAITING / NONE → 그대로 대기 화면 (계속 폴링)
                   └─ MATCHED        → 폴링 자동 중지 (이후 미구현)

[페이지 이탈 — 모든 경로]
   │
   ▼
[unmount cleanup]
   │
   └─ enteredRef.current === true 이면 cancelMatchingQueue(userId) (fire-and-forget)
```

### 코드 골격

```tsx
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { env } from "@/config/env";
import { cancelMatchingQueue } from "@/domains/matching/api/matchingApi";
import { useEnterMatchingQueue } from "@/domains/matching/hooks/useEnterMatchingQueue";
import { useMatchingStatus } from "@/domains/matching/hooks/useMatchingStatus";
import { useRandomIcebreakers } from "@/domains/icebreaker/hooks/useRandomIcebreakers";
// ...

const ICEBREAKER_COUNT = 5;
const ROTATION_INTERVAL_MS = 7000;
const FADE_MS = 280;

export function MatchingPage() {
  const navigate = useNavigate();
  const userId = env.devUserId;
  const [sheetOpen, setSheetOpen] = useState(false);
  const { data: icebreakers } = useRandomIcebreakers(ICEBREAKER_COUNT);

  const enter = useEnterMatchingQueue();
  const status = useMatchingStatus(userId, enter.isSuccess);

  const enteredRef = useRef(false);

  useEffect(() => {
    enter.mutate(userId, {
      onSuccess: () => {
        enteredRef.current = true;
      },
    });
    return () => {
      if (enteredRef.current) {
        cancelMatchingQueue(userId).catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const handleCancel = () => {
    setSheetOpen(false);
    navigate("/");
  };

  // enter.isError → 에러 화면 (MyPagePage 패턴 참고)
  // 그 외 → 기존 BreathingOrb + IcebreakerRotator + CancelConfirmSheet UI 그대로
}
```

### 에러 UI

`MyPagePage`의 에러 화면 패턴을 따른다:

- 메시지: "매칭을 시작할 수 없어요."
- 버튼 1 — "다시 시도": `enter.mutate(userId, { onSuccess: ... })` 재호출
- 버튼 2 — "메인으로": `navigate("/")`

`useMatchingStatus`의 isError(폴링 실패)는 사용자에게 별도로 노출하지 않는다 — TanStack Query의 자동 재시도에 맡기고 화면은 대기 상태 유지 (아이스브레이커 fallback 처리와 동일한 톤).

## 7. 단일 진입점 보장

DELETE는 cleanup에서만 발생한다.

| 이탈 경로 | 동작 |
| --- | --- |
| 시트의 "취소하기" 클릭 | `navigate("/")` → 언마운트 → cleanup → DELETE |
| 라우터 변경 (Bottom tab 등) | 언마운트 → cleanup → DELETE |
| `MATCHED` 후 다음 화면 (후속 작업) | 언마운트 → cleanup → DELETE (백엔드는 멱등이라 no-op) |

→ 어떤 경로든 정확히 1회 DELETE.

## 8. MSW 핸들러

`test/msw/handlers.ts`에 다음을 추가:

```ts
http.post(`${env.apiBaseUrl}/users/:userId/matching`, () =>
  HttpResponse.json({ data: null, status: 204, message: "NO_CONTENT" }),
),
http.get(`${env.apiBaseUrl}/users/:userId/matching`, () =>
  HttpResponse.json({
    data: { status: "WAITING", partnerId: null },
    status: 200,
    message: "OK",
  }),
),
http.delete(`${env.apiBaseUrl}/users/:userId/matching`, () =>
  HttpResponse.json({ data: null, status: 204, message: "NO_CONTENT" }),
),
```

## 9. 테스트 전략

### `src/lib/http.test.ts` (추가)
- `httpPost` 200/204 응답에서 `data` 언랩
- `httpPost` 4xx/5xx → `ApiError` throw
- `httpDelete` 동일 케이스 2종

### `src/domains/matching/api/matchingApi.test.ts`
- `enterMatchingQueue(userId)` → 204 정상 동작
- `enterMatchingQueue` 실패 시 `ApiError`
- `cancelMatchingQueue(userId)` → 204 정상 동작
- `fetchMatchingStatus(userId)` → `MatchingStatus` 반환
- `fetchMatchingStatus`가 받은 `status` enum 3종(`MATCHED`/`WAITING`/`NONE`) 모두 통과

### `src/domains/matching/hooks/useEnterMatchingQueue.test.tsx`
- 성공 시 `isSuccess: true`
- 실패 시 `isError: true`

### `src/domains/matching/hooks/useMatchingStatus.test.tsx`
- `enabled=false`일 때 호출 안 함
- `enabled=true`일 때 첫 호출 → `WAITING` 데이터 반환
- 폴링 간격에 맞춰 N회 호출되는지 (vitest fake timers 또는 `waitFor`로 횟수 확인)
- `MATCHED` 응답을 받으면 더 이상 호출되지 않는지 (가장 중요한 회귀 보호 포인트)

### `src/pages/matching/MatchingPage.test.tsx` (확장)

기존 케이스 유지 + 추가:
- 마운트 시 `POST /users/{userId}/matching` 1회 송신
- 언마운트 시 `DELETE /users/{userId}/matching` 1회 송신
- POST 실패 시 에러 UI 노출 + "다시 시도" 클릭하면 POST 재호출
- "취소하기" 클릭 시 `/`로 navigate + DELETE 송신
- POST가 실패한 상태에서 언마운트되면 DELETE는 송신되지 않음 (`enteredRef` 가드 검증)

목표 커버리지: 80% 이상 유지 (CLAUDE.md 규칙).

## 10. 알려진 한계

- POST 진행 중에 페이지를 떠나면 cleanup의 가드(`enteredRef`)에 의해 DELETE를 보내지 않는다. POST가 늦게 백엔드에 도착하면 잠깐 큐에 적재될 수 있으나, 백엔드 워커가 3초 주기로 매칭/정리하고 결과 TTL이 15초이므로 다음 입장 시 정상화된다.
- `NONE` 상태에서 자동 재입장은 하지 않는다. 본 작업 범위에서는 단순화 (TTL 만료 가능성은 후속 작업에서 다룸).
- 네이티브 환경(앱 강제 종료, 백그라운드 진입 시 WebView 정리)에서 cleanup이 실행되지 않을 수 있음. Capacitor 라이프사이클 훅 연동은 후속 과제.
