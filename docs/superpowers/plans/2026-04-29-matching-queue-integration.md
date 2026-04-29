# 매칭 대기열 연동 구현 플랜

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 매칭 페이지 진입 시 매칭 큐에 입장(POST)하고 3초 주기로 상태를 폴링(GET), 페이지 이탈 시 큐에서 이탈(DELETE)하는 기능을 구현한다.

**Architecture:** 매칭 큐 라이프사이클(입장·폴링·이탈) 책임을 `MatchingPage` 한 곳에 응집한다. POST·DELETE는 mutation/ API 함수 직접 호출, GET은 TanStack Query의 `refetchInterval`로 폴링. DELETE는 `useEffect` cleanup 단일 진입점으로 모든 이탈 경로에서 1회만 송신.

**Tech Stack:** React 18, TypeScript, TanStack Query v5, MSW v2, Vitest, React Router v7

**Spec:** `docs/superpowers/specs/2026-04-29-matching-queue-integration-design.md`

---

## File Structure

신규/수정 파일 일람:

| 경로 | 액션 | 책임 |
| --- | --- | --- |
| `src/lib/http.ts` | 수정 | `httpPost`, `httpDelete` 추가 |
| `src/lib/http.test.ts` | 수정 | 위 두 함수 테스트 추가 |
| `src/domains/matching/types.ts` | 신규 | `MatchStatus`, `MatchingStatus` 타입 |
| `src/domains/matching/api/matchingApi.ts` | 신규 | `enterMatchingQueue`, `cancelMatchingQueue`, `fetchMatchingStatus` |
| `src/domains/matching/api/matchingApi.test.ts` | 신규 | 위 3개 함수 테스트 |
| `src/domains/matching/hooks/useEnterMatchingQueue.ts` | 신규 | POST mutation 훅 |
| `src/domains/matching/hooks/useEnterMatchingQueue.test.tsx` | 신규 | 훅 테스트 |
| `src/domains/matching/hooks/useMatchingStatus.ts` | 신규 | 3초 폴링 query 훅 |
| `src/domains/matching/hooks/useMatchingStatus.test.tsx` | 신규 | 훅 테스트 (폴링 중지 포함) |
| `test/msw/handlers.ts` | 수정 | matching 엔드포인트 3종 핸들러 추가 |
| `src/pages/matching/MatchingPage.tsx` | 수정 | POST/폴링/DELETE 와이어링 + 에러 UI |
| `src/pages/matching/MatchingPage.test.tsx` | 수정 | 통합 테스트 추가 |

---

## Task 1: HTTP 레이어 — `httpPost`

**Files:**
- Modify: `src/lib/http.ts` (현재 `httpGet`만 존재, 1~28행)
- Modify: `src/lib/http.test.ts`

- [ ] **Step 1: `httpPost` 실패 테스트 작성**

`src/lib/http.test.ts` 하단에 describe 블록 추가. 기존 import 끝에 `httpPost` 추가 — `import { ApiError, httpGet, httpPost } from "./http";`

```ts
describe("httpPost", () => {
  it("2xx 응답에서 ApiResponse 를 언랩해 data 만 반환한다", async () => {
    server.use(
      http.post("http://localhost:3000/users/1/matching", () =>
        HttpResponse.json({
          data: null,
          status: 204,
          message: "NO_CONTENT",
        }),
      ),
    );

    const result = await httpPost<null>("/users/1/matching");

    expect(result).toBeNull();
  });

  it("4xx 응답에서 ApiError 를 throw 한다", async () => {
    server.use(
      http.post("http://localhost:3000/users/999/matching", () =>
        HttpResponse.json(
          { data: null, status: 404, message: "사용자를 찾을 수 없습니다." },
          { status: 404 },
        ),
      ),
    );

    await expect(httpPost("/users/999/matching")).rejects.toMatchObject({
      name: "ApiError",
      status: 404,
      message: "사용자를 찾을 수 없습니다.",
    });
  });

  it("4xx body 에 message 가 없으면 Unknown error 로 throw 한다", async () => {
    server.use(
      http.post("http://localhost:3000/nomsg", () =>
        HttpResponse.json({ data: null }, { status: 500 }),
      ),
    );

    await expect(httpPost("/nomsg")).rejects.toMatchObject({
      name: "ApiError",
      status: 500,
      message: "Unknown error",
    });
  });
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `npm run test:run -- src/lib/http.test.ts`
Expected: 새 테스트 3개가 `httpPost is not exported` 또는 유사한 사유로 FAIL.

- [ ] **Step 3: `httpPost` 구현**

`src/lib/http.ts`의 `httpGet` 함수 아래에 추가:

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
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `npm run test:run -- src/lib/http.test.ts`
Expected: 모든 테스트 PASS.

- [ ] **Step 5: 타입체크 + 린트 확인**

Run: `npm run typecheck && npm run lint`
Expected: 에러 없음.

- [ ] **Step 6: 커밋**

```bash
git add src/lib/http.ts src/lib/http.test.ts
git commit -m "feat: httpPost 헬퍼 추가"
```

---

## Task 2: HTTP 레이어 — `httpDelete`

**Files:**
- Modify: `src/lib/http.ts`
- Modify: `src/lib/http.test.ts`

- [ ] **Step 1: `httpDelete` 실패 테스트 작성**

기존 import에 `httpDelete` 추가 — `import { ApiError, httpDelete, httpGet, httpPost } from "./http";`

테스트 파일 하단에 describe 추가:

```ts
describe("httpDelete", () => {
  it("2xx 응답에서 ApiResponse 를 언랩해 data 만 반환한다", async () => {
    server.use(
      http.delete("http://localhost:3000/users/1/matching", () =>
        HttpResponse.json({
          data: null,
          status: 204,
          message: "NO_CONTENT",
        }),
      ),
    );

    const result = await httpDelete<null>("/users/1/matching");

    expect(result).toBeNull();
  });

  it("4xx 응답에서 ApiError 를 throw 한다", async () => {
    server.use(
      http.delete("http://localhost:3000/users/999/matching", () =>
        HttpResponse.json(
          { data: null, status: 500, message: "BOOM" },
          { status: 500 },
        ),
      ),
    );

    await expect(httpDelete("/users/999/matching")).rejects.toMatchObject({
      name: "ApiError",
      status: 500,
      message: "BOOM",
    });
  });
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `npm run test:run -- src/lib/http.test.ts`
Expected: 새 테스트 2개 FAIL.

- [ ] **Step 3: `httpDelete` 구현**

`src/lib/http.ts`의 `httpPost` 함수 아래에 추가:

```ts
export async function httpDelete<T = void>(path: string): Promise<T> {
  const res = await fetch(`${env.apiBaseUrl}${path}`, { method: "DELETE" });
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
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `npm run test:run -- src/lib/http.test.ts`
Expected: 모든 테스트 PASS.

- [ ] **Step 5: 타입체크 + 린트**

Run: `npm run typecheck && npm run lint`
Expected: 에러 없음.

- [ ] **Step 6: 커밋**

```bash
git add src/lib/http.ts src/lib/http.test.ts
git commit -m "feat: httpDelete 헬퍼 추가"
```

---

## Task 3: 매칭 도메인 — types + API 함수 + MSW 기본 핸들러

**Files:**
- Create: `src/domains/matching/types.ts`
- Create: `src/domains/matching/api/matchingApi.ts`
- Create: `src/domains/matching/api/matchingApi.test.ts`
- Modify: `test/msw/handlers.ts` (현재 5개 GET 핸들러 — `users/:userId/my`, `users/:userId/stats`, `users/:userId/expressions`, `recommended-expressions/daily`, `icebreakers`)

- [ ] **Step 1: MSW 기본 핸들러 추가**

`test/msw/handlers.ts`의 마지막 핸들러(`icebreakers`) 뒤에 추가. `]` 닫기 전에 다음 3개 삽입:

```ts
  http.post(`${env.apiBaseUrl}/users/:userId/matching`, () => {
    return HttpResponse.json({
      data: null,
      status: 204,
      message: "NO_CONTENT",
    });
  }),

  http.get(`${env.apiBaseUrl}/users/:userId/matching`, () => {
    return HttpResponse.json({
      data: { status: "WAITING", partnerId: null },
      status: 200,
      message: "OK",
    });
  }),

  http.delete(`${env.apiBaseUrl}/users/:userId/matching`, () => {
    return HttpResponse.json({
      data: null,
      status: 204,
      message: "NO_CONTENT",
    });
  }),
```

- [ ] **Step 2: 매칭 API 실패 테스트 작성**

`src/domains/matching/api/matchingApi.test.ts` 신규 파일:

```ts
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "../../../../test/msw/server";
import {
  cancelMatchingQueue,
  enterMatchingQueue,
  fetchMatchingStatus,
} from "./matchingApi";

describe("enterMatchingQueue", () => {
  it("204 응답이면 정상 종료한다", async () => {
    await expect(enterMatchingQueue(1)).resolves.toBeNull();
  });

  it("5xx 응답이면 ApiError 를 throw 한다", async () => {
    server.use(
      http.post("http://localhost:3000/users/1/matching", () =>
        HttpResponse.json(
          { data: null, status: 500, message: "QUEUE_UNAVAILABLE" },
          { status: 500 },
        ),
      ),
    );

    await expect(enterMatchingQueue(1)).rejects.toThrow("QUEUE_UNAVAILABLE");
  });
});

describe("cancelMatchingQueue", () => {
  it("204 응답이면 정상 종료한다", async () => {
    await expect(cancelMatchingQueue(1)).resolves.toBeNull();
  });
});

describe("fetchMatchingStatus", () => {
  it("기본 응답이면 WAITING 상태를 반환한다", async () => {
    const result = await fetchMatchingStatus(1);
    expect(result).toEqual({ status: "WAITING", partnerId: null });
  });

  it("MATCHED 응답이면 partnerId 가 채워져 반환된다", async () => {
    server.use(
      http.get("http://localhost:3000/users/1/matching", () =>
        HttpResponse.json({
          data: { status: "MATCHED", partnerId: 42 },
          status: 200,
          message: "OK",
        }),
      ),
    );

    const result = await fetchMatchingStatus(1);
    expect(result).toEqual({ status: "MATCHED", partnerId: 42 });
  });

  it("NONE 응답도 그대로 반환된다", async () => {
    server.use(
      http.get("http://localhost:3000/users/1/matching", () =>
        HttpResponse.json({
          data: { status: "NONE", partnerId: null },
          status: 200,
          message: "OK",
        }),
      ),
    );

    const result = await fetchMatchingStatus(1);
    expect(result.status).toBe("NONE");
  });
});
```

- [ ] **Step 3: 테스트 실행 → 실패 확인**

Run: `npm run test:run -- src/domains/matching/`
Expected: import 실패 (`matchingApi` 모듈 없음).

- [ ] **Step 4: 타입 파일 생성**

`src/domains/matching/types.ts`:

```ts
export type MatchStatus = "MATCHED" | "WAITING" | "NONE";

export type MatchingStatus = {
  status: MatchStatus;
  partnerId: number | null;
};
```

- [ ] **Step 5: API 함수 구현**

`src/domains/matching/api/matchingApi.ts`:

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

- [ ] **Step 6: 테스트 실행 → 통과 확인**

Run: `npm run test:run -- src/domains/matching/`
Expected: 모든 테스트 PASS.

- [ ] **Step 7: 전체 테스트 + 타입체크**

Run: `npm run test:run && npm run typecheck && npm run lint`
Expected: 모두 PASS.

- [ ] **Step 8: 커밋**

```bash
git add src/domains/matching/ test/msw/handlers.ts
git commit -m "feat: 매칭 도메인 타입과 API 함수 추가"
```

---

## Task 4: `useEnterMatchingQueue` mutation 훅

**Files:**
- Create: `src/domains/matching/hooks/useEnterMatchingQueue.ts`
- Create: `src/domains/matching/hooks/useEnterMatchingQueue.test.tsx`

- [ ] **Step 1: 실패 테스트 작성**

`src/domains/matching/hooks/useEnterMatchingQueue.test.tsx`:

```tsx
import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { server } from "../../../../test/msw/server";
import { createTestQueryClient } from "../../../../test/utils/renderWithQueryClient";
import { useEnterMatchingQueue } from "./useEnterMatchingQueue";

const wrapper = ({ children }: { children: ReactNode }) => {
  const queryClient = createTestQueryClient();
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useEnterMatchingQueue", () => {
  it("mutate 호출 후 성공하면 isSuccess 가 true 다", async () => {
    const { result } = renderHook(() => useEnterMatchingQueue(), { wrapper });

    result.current.mutate(1);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("500 응답이면 isError 가 true 다", async () => {
    server.use(
      http.post("http://localhost:3000/users/1/matching", () =>
        HttpResponse.json(
          { data: null, status: 500, message: "fail" },
          { status: 500 },
        ),
      ),
    );

    const { result } = renderHook(() => useEnterMatchingQueue(), { wrapper });

    result.current.mutate(1);

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `npm run test:run -- src/domains/matching/hooks/useEnterMatchingQueue.test.tsx`
Expected: 모듈 없음 에러로 FAIL.

- [ ] **Step 3: 훅 구현**

`src/domains/matching/hooks/useEnterMatchingQueue.ts`:

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

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `npm run test:run -- src/domains/matching/hooks/useEnterMatchingQueue.test.tsx`
Expected: 두 테스트 모두 PASS.

- [ ] **Step 5: 타입체크 + 린트**

Run: `npm run typecheck && npm run lint`
Expected: 에러 없음.

- [ ] **Step 6: 커밋**

```bash
git add src/domains/matching/hooks/useEnterMatchingQueue.ts src/domains/matching/hooks/useEnterMatchingQueue.test.tsx
git commit -m "feat: useEnterMatchingQueue 훅 추가"
```

---

## Task 5: `useMatchingStatus` 폴링 훅

**Files:**
- Create: `src/domains/matching/hooks/useMatchingStatus.ts`
- Create: `src/domains/matching/hooks/useMatchingStatus.test.tsx`

- [ ] **Step 1: 실패 테스트 작성**

`src/domains/matching/hooks/useMatchingStatus.test.tsx`:

```tsx
import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "../../../../test/msw/server";
import { createTestQueryClient } from "../../../../test/utils/renderWithQueryClient";
import { useMatchingStatus } from "./useMatchingStatus";

const wrapper = ({ children }: { children: ReactNode }) => {
  const queryClient = createTestQueryClient();
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useMatchingStatus", () => {
  it("enabled=false 면 호출하지 않는다", async () => {
    let callCount = 0;
    server.use(
      http.get("http://localhost:3000/users/1/matching", () => {
        callCount++;
        return HttpResponse.json({
          data: { status: "WAITING", partnerId: null },
          status: 200,
          message: "OK",
        });
      }),
    );

    renderHook(() => useMatchingStatus(1, false), { wrapper });

    // 짧게 대기 후 호출 0회 확인
    await new Promise((r) => setTimeout(r, 50));
    expect(callCount).toBe(0);
  });

  it("enabled=true 면 WAITING 데이터를 반환한다", async () => {
    const { result } = renderHook(() => useMatchingStatus(1, true), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({
      status: "WAITING",
      partnerId: null,
    });
  });

  it("MATCHED 응답을 받으면 폴링이 멈춘다", async () => {
    let callCount = 0;
    server.use(
      http.get("http://localhost:3000/users/1/matching", () => {
        callCount++;
        return HttpResponse.json({
          data: { status: "MATCHED", partnerId: 2 },
          status: 200,
          message: "OK",
        });
      }),
    );

    vi.useFakeTimers({ shouldAdvanceTime: true });

    const { result } = renderHook(() => useMatchingStatus(1, true), {
      wrapper,
    });

    await waitFor(() =>
      expect(result.current.data?.status).toBe("MATCHED"),
    );
    expect(callCount).toBe(1);

    // 폴링 간격(3s)의 3배 시간 진행 — 추가 호출이 없어야 함
    await vi.advanceTimersByTimeAsync(10000);
    expect(callCount).toBe(1);

    vi.useRealTimers();
  });

  it("WAITING 응답이면 3초 후 다시 폴링한다", async () => {
    let callCount = 0;
    server.use(
      http.get("http://localhost:3000/users/1/matching", () => {
        callCount++;
        return HttpResponse.json({
          data: { status: "WAITING", partnerId: null },
          status: 200,
          message: "OK",
        });
      }),
    );

    vi.useFakeTimers({ shouldAdvanceTime: true });

    const { result } = renderHook(() => useMatchingStatus(1, true), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const firstCallCount = callCount;

    await vi.advanceTimersByTimeAsync(3500);
    await waitFor(() => expect(callCount).toBeGreaterThan(firstCallCount));

    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `npm run test:run -- src/domains/matching/hooks/useMatchingStatus.test.tsx`
Expected: 모듈 없음 에러로 FAIL.

- [ ] **Step 3: 훅 구현**

`src/domains/matching/hooks/useMatchingStatus.ts`:

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

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `npm run test:run -- src/domains/matching/hooks/useMatchingStatus.test.tsx`
Expected: 4개 테스트 모두 PASS.

- [ ] **Step 5: 타입체크 + 린트**

Run: `npm run typecheck && npm run lint`
Expected: 에러 없음.

- [ ] **Step 6: 커밋**

```bash
git add src/domains/matching/hooks/useMatchingStatus.ts src/domains/matching/hooks/useMatchingStatus.test.tsx
git commit -m "feat: useMatchingStatus 폴링 훅 추가"
```

---

## Task 6: `MatchingPage` 와이어링 — POST + 에러 UI + 폴링 + DELETE cleanup

**Files:**
- Modify: `src/pages/matching/MatchingPage.tsx` (현재 1~107행)
- Modify: `src/pages/matching/MatchingPage.test.tsx`

이 태스크는 페이지 한 파일에 변경이 모이므로 단일 커밋으로 진행한다. 신규 동작 4가지를 한 번에 통합 테스트로 검증.

- [ ] **Step 1: 통합 테스트 추가**

`src/pages/matching/MatchingPage.test.tsx` 상단 import 영역을 다음과 같이 갱신 (`http`, `HttpResponse`, `server`는 기존, `vi`만 추가):

```tsx
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { server } from "../../../test/msw/server";
import { renderWithQueryClient } from "../../../test/utils/renderWithQueryClient";
import { MatchingPage } from "./MatchingPage";
```

기존 describe 블록 안 마지막 it 다음에 다음 테스트를 추가:

```tsx
  it("마운트 시 매칭 큐 입장 POST 를 1회 송신한다", async () => {
    let postCount = 0;
    server.use(
      http.post("http://localhost:3000/users/1/matching", () => {
        postCount++;
        return HttpResponse.json({
          data: null,
          status: 204,
          message: "NO_CONTENT",
        });
      }),
    );

    renderWithQueryClient(<MatchingPage />);

    await waitFor(() => expect(postCount).toBe(1));
  });

  it("POST 가 실패하면 에러 메시지와 다시 시도 / 메인으로 버튼이 나온다", async () => {
    server.use(
      http.post("http://localhost:3000/users/1/matching", () =>
        HttpResponse.json(
          { data: null, status: 500, message: "fail" },
          { status: 500 },
        ),
      ),
    );

    renderWithQueryClient(<MatchingPage />);

    expect(
      await screen.findByText("매칭을 시작할 수 없어요."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "다시 시도" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "메인으로" }),
    ).toBeInTheDocument();
  });

  it("'다시 시도' 클릭 시 POST 를 재호출한다", async () => {
    const user = userEvent.setup();
    let postCount = 0;
    server.use(
      http.post("http://localhost:3000/users/1/matching", () => {
        postCount++;
        return HttpResponse.json(
          { data: null, status: 500, message: "fail" },
          { status: 500 },
        );
      }),
    );

    renderWithQueryClient(<MatchingPage />);

    await screen.findByText("매칭을 시작할 수 없어요.");
    expect(postCount).toBe(1);

    await user.click(screen.getByRole("button", { name: "다시 시도" }));

    await waitFor(() => expect(postCount).toBe(2));
  });

  it("POST 성공 후 언마운트 시 DELETE 를 1회 송신한다", async () => {
    let postCount = 0;
    let deleteCount = 0;
    server.use(
      http.post("http://localhost:3000/users/1/matching", () => {
        postCount++;
        return HttpResponse.json({
          data: null,
          status: 204,
          message: "NO_CONTENT",
        });
      }),
      http.delete("http://localhost:3000/users/1/matching", () => {
        deleteCount++;
        return HttpResponse.json({
          data: null,
          status: 204,
          message: "NO_CONTENT",
        });
      }),
    );

    const { unmount } = renderWithQueryClient(<MatchingPage />);
    await waitFor(() => expect(postCount).toBe(1));

    unmount();

    await waitFor(() => expect(deleteCount).toBe(1));
  });

  it("POST 가 실패한 채 언마운트되면 DELETE 를 보내지 않는다", async () => {
    let deleteCount = 0;
    server.use(
      http.post("http://localhost:3000/users/1/matching", () =>
        HttpResponse.json(
          { data: null, status: 500, message: "fail" },
          { status: 500 },
        ),
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

    const { unmount } = renderWithQueryClient(<MatchingPage />);
    await screen.findByText("매칭을 시작할 수 없어요.");

    unmount();

    // 잠깐 대기해서 혹시 비동기로 호출되는지 확인
    await new Promise((r) => setTimeout(r, 50));
    expect(deleteCount).toBe(0);
  });

  it("POST 성공 후 GET 매칭 상태를 폴링한다", async () => {
    let getCount = 0;
    server.use(
      http.get("http://localhost:3000/users/1/matching", () => {
        getCount++;
        return HttpResponse.json({
          data: { status: "WAITING", partnerId: null },
          status: 200,
          message: "OK",
        });
      }),
    );

    renderWithQueryClient(<MatchingPage />);

    await waitFor(() => expect(getCount).toBeGreaterThanOrEqual(1));
  });

  it("'취소하기' 버튼 클릭 시 / 로 navigate 하고 DELETE 가 송신된다", async () => {
    const user = userEvent.setup();
    let deleteCount = 0;
    server.use(
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
        <Route path="/matching" element={<MatchingPage />} />
        <Route path="/" element={<div>메인 화면</div>} />
      </Routes>,
      { initialEntries: ["/matching"] },
    );

    // POST 성공 대기 (enteredRef 가 true 가 되어야 cleanup 이 DELETE 를 보냄)
    await waitFor(() => expect(screen.getByText("매칭 중")).toBeInTheDocument());
    // mutation 이 settled 될 시간 부여
    await new Promise((r) => setTimeout(r, 50));

    await user.click(screen.getByRole("button", { name: "매칭 취소" }));
    await user.click(screen.getByRole("button", { name: "취소하기" }));

    expect(await screen.findByText("메인 화면")).toBeInTheDocument();
    await waitFor(() => expect(deleteCount).toBe(1));
  });
```

기존 "'취소하기' 를 누르면 / 로 navigate 한다" 테스트는 위 마지막 테스트에서 DELETE 검증까지 포함하므로 **삭제**한다. 즉 기존 마지막 it 블록(라인 71~85)을 위 새 테스트로 교체.

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `npm run test:run -- src/pages/matching/MatchingPage.test.tsx`
Expected: 새 케이스들이 FAIL (구현 전이라 POST/DELETE 호출 카운트가 늘지 않음, 에러 UI도 없음).

- [ ] **Step 3: `MatchingPage` 구현 — 전체 교체**

`src/pages/matching/MatchingPage.tsx` 전체를 다음으로 교체:

```tsx
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { env } from "@/config/env";
import { cancelMatchingQueue } from "@/domains/matching/api/matchingApi";
import { useEnterMatchingQueue } from "@/domains/matching/hooks/useEnterMatchingQueue";
import { useMatchingStatus } from "@/domains/matching/hooks/useMatchingStatus";
import { useRandomIcebreakers } from "@/domains/icebreaker/hooks/useRandomIcebreakers";
import { BreathingOrb } from "./BreathingOrb";
import { CancelConfirmSheet } from "./CancelConfirmSheet";
import { FALLBACK_ICEBREAKERS } from "./fallbackIcebreakers";
import { IcebreakerRotator } from "./IcebreakerRotator";

const ICEBREAKER_COUNT = 5;
const ROTATION_INTERVAL_MS = 7000;
const FADE_MS = 280;

export function MatchingPage() {
  const navigate = useNavigate();
  const userId = env.devUserId;
  const [sheetOpen, setSheetOpen] = useState(false);
  const { data } = useRandomIcebreakers(ICEBREAKER_COUNT);

  const enter = useEnterMatchingQueue();
  useMatchingStatus(userId, enter.isSuccess);

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

  const sentences = data ?? FALLBACK_ICEBREAKERS;

  const openSheet = () => setSheetOpen(true);
  const closeSheet = () => setSheetOpen(false);
  const handleCancel = () => {
    setSheetOpen(false);
    navigate("/");
  };

  const handleRetry = () => {
    enter.mutate(userId, {
      onSuccess: () => {
        enteredRef.current = true;
      },
    });
  };
  const handleGoHome = () => navigate("/");

  return (
    <div className="viewport flex min-h-dvh items-center justify-center bg-[#E7EAEE] p-6">
      <div className="phone relative h-[812px] w-[375px] overflow-hidden rounded-[44px] bg-white shadow-[0_0_0_10px_#1A1D22,0_30px_60px_rgba(0,0,0,0.25)] md:h-dvh md:w-full md:rounded-none md:shadow-none">
        <header className="relative z-10 flex h-11 items-center justify-between bg-white px-6 text-[15px] font-semibold text-gray-900">
          <span>9:41</span>
        </header>

        <main className="relative flex h-[calc(100%-44px)] flex-col overflow-hidden bg-gradient-to-b from-mint-50 to-white">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -right-20 -top-[70px] z-0 h-[280px] w-[280px] rounded-full bg-mint-200 opacity-35 blur-[60px]"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -left-20 bottom-40 z-0 h-[220px] w-[220px] rounded-full bg-coral-100 opacity-55 blur-[60px]"
          />

          <div className="relative z-[5] flex items-center justify-between px-4 pt-2">
            <button
              type="button"
              aria-label="닫기"
              onClick={openSheet}
              className="flex h-10 w-10 items-center justify-center rounded-xl text-gray-700 active:bg-gray-100"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
            <span className="text-[15px] font-semibold leading-none tracking-[-0.01em] text-gray-800">
              매칭 중
            </span>
            <span className="w-10" />
          </div>

          {enter.isError ? (
            <div className="relative z-[1] flex flex-1 flex-col items-center justify-center gap-4 px-6">
              <p className="m-0 text-[15px] font-medium text-gray-700">
                매칭을 시작할 수 없어요.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleRetry}
                  className="rounded-md bg-mint-500 px-5 py-2.5 text-[14px] font-semibold text-white"
                >
                  다시 시도
                </button>
                <button
                  type="button"
                  onClick={handleGoHome}
                  className="rounded-md border border-gray-300 px-5 py-2.5 text-[14px] font-semibold text-gray-700"
                >
                  메인으로
                </button>
              </div>
            </div>
          ) : (
            <div className="relative z-[1] flex flex-1 flex-col items-center px-6 pt-5">
              <BreathingOrb />

              <div className="mb-4 text-center">
                <h1 className="m-0 mb-1.5 text-[20px] font-bold leading-snug tracking-[-0.02em] text-gray-900">
                  대화할 사람을 찾고 있어요
                </h1>
                <p className="m-0 text-[13px] font-medium leading-relaxed text-gray-600">
                  보통 <strong className="font-bold text-mint-600">30초 이내</strong>에 매칭돼요
                </p>
              </div>

              <IcebreakerRotator
                sentences={sentences}
                intervalMs={ROTATION_INTERVAL_MS}
                fadeMs={FADE_MS}
              />

              <div className="mt-auto flex justify-center pb-6 pt-2">
                <button
                  type="button"
                  onClick={openSheet}
                  className="rounded-md px-5 py-3.5 text-[14px] font-semibold leading-none tracking-[-0.01em] text-gray-500 active:bg-gray-100 active:text-gray-700"
                >
                  매칭 취소
                </button>
              </div>
            </div>
          )}

          <CancelConfirmSheet
            open={sheetOpen}
            onKeep={closeSheet}
            onCancel={handleCancel}
          />
        </main>
      </div>
    </div>
  );
}
```

주요 변경:
- 상단 import 4개 추가 (`useEffect`, `useRef`, `env`, `cancelMatchingQueue`, `useEnterMatchingQueue`, `useMatchingStatus`)
- `userId`, `enter`, `useMatchingStatus`, `enteredRef`, `useEffect` 추가
- `handleRetry`, `handleGoHome` 추가
- `enter.isError` 분기로 에러 UI / 정상 UI 갈라짐
- `data` 변수명은 기존 `useRandomIcebreakers`의 반환과 일관 유지

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `npm run test:run -- src/pages/matching/MatchingPage.test.tsx`
Expected: 모든 테스트 PASS.

`useEffect`의 deps 경고가 ESLint에서 발생할 수 있는데, 현재 코드에는 `// eslint-disable-next-line react-hooks/exhaustive-deps`가 있으므로 문제 없어야 한다.

- [ ] **Step 5: 전체 테스트 + 타입체크 + 린트**

Run: `npm run test:run && npm run typecheck && npm run lint`
Expected: 모두 PASS, 린트 경고 0.

- [ ] **Step 6: 커버리지 확인**

Run: `npm run coverage`
Expected: 매칭 도메인 (`src/domains/matching/`) 및 `MatchingPage.tsx` 커버리지 80% 이상.

- [ ] **Step 7: 개발 서버에서 수동 확인**

Run: `npm run dev`

브라우저에서 `/`로 진입 → "통화 시작하기" 클릭 → `/matching` 진입 → 네트워크 탭에서 다음 확인:

1. `POST /users/{devUserId}/matching` 1회 송신 (204).
2. 3초 간격으로 `GET /users/{devUserId}/matching` 반복 호출.
3. "매칭 취소" → 시트 → "취소하기" 클릭 → `/`로 이동 + `DELETE /users/{devUserId}/matching` 1회 송신.
4. 다시 진입 → 메인의 다른 페이지로 이동 (탭바 등) → 그 시점에도 DELETE 1회 송신.

(백엔드가 안 떠 있으면 네트워크 탭에서 호출 자체와 메서드/경로/payload만 확인.)

- [ ] **Step 8: 커밋**

```bash
git add src/pages/matching/MatchingPage.tsx src/pages/matching/MatchingPage.test.tsx
git commit -m "feat: 매칭 페이지에 큐 입장·폴링·이탈 연동"
```

---

## 완료 후 정리

- [ ] **최종 확인**

Run: `npm run test:run && npm run typecheck && npm run lint && npm run coverage`
Expected:
- 모든 테스트 PASS
- 타입체크 에러 0
- 린트 경고 0
- 커버리지 80% 이상 (`src/domains/matching/`, `src/lib/http.ts`, `src/pages/matching/MatchingPage.tsx`)

- [ ] **PR 생성 (사용자 요청 시)**

`/skill github-pr` 또는 사용자가 명시적으로 요청 시.

PR 본문 요약 포인트:
- POST `/users/{userId}/matching` 마운트 시 송신, 실패 시 다시 시도 UI
- 3초 주기 GET 폴링, MATCHED 수신 시 자동 중지
- DELETE는 useEffect cleanup 단일 진입점에서 1회 (멱등 안전)
- `httpPost`, `httpDelete` 헬퍼 추가
- 매칭 도메인 신규 (`src/domains/matching/`)
