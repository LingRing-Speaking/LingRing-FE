# 매칭 페이지 구현 계획 (Matching Page Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `lingring_matching.html` 목업을 `/matching` 라우트의 React 페이지로 포팅하고, 아이스브레이커 문장을 백엔드에서 받아 회전시킨다.

**Architecture:** 새 도메인(`src/domains/icebreaker/`)에서 `GET /icebreakers?count=5`를 호출해 5개 문장을 받는다. `MatchingPage`는 폴백 문장으로 즉시 회전을 시작하고, 응답이 도착하면 카드 내용만 교체한다. 회전 타이머·페이드 전환은 `useSentenceRotation` 훅이 담당하고, 취소 시트는 별도 presentational 컴포넌트로 분리한다. 메인의 통화 버튼(`CallHero`)을 활성화해 `/matching`으로 navigate.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind, React Router v7, TanStack Query v5, Vitest, MSW, React Testing Library.

**Spec:** `docs/superpowers/specs/2026-04-28-matching-page-design.md`

---

## File Structure

**Create:**
- `src/domains/icebreaker/types.ts`
- `src/domains/icebreaker/api/icebreakerApi.ts`
- `src/domains/icebreaker/api/icebreakerApi.test.ts`
- `src/domains/icebreaker/hooks/useRandomIcebreakers.ts`
- `src/domains/icebreaker/hooks/useRandomIcebreakers.test.tsx`
- `src/pages/matching/fallbackIcebreakers.ts`
- `src/pages/matching/useSentenceRotation.ts`
- `src/pages/matching/useSentenceRotation.test.ts`
- `src/pages/matching/BreathingOrb.tsx`
- `src/pages/matching/IcebreakerRotator.tsx`
- `src/pages/matching/IcebreakerRotator.test.tsx`
- `src/pages/matching/CancelConfirmSheet.tsx`
- `src/pages/matching/MatchingPage.tsx`
- `src/pages/matching/MatchingPage.test.tsx`

**Modify:**
- `tailwind.config.ts` — boxShadow.orb + breathe/halo/dotBlink keyframes & animations
- `test/msw/handlers.ts` — `/icebreakers` 핸들러 추가
- `src/App.tsx` — `/matching` 라우트 등록
- `src/pages/main/CallHero.tsx` — disabled 제거, `useNavigate`로 `/matching` 이동
- `src/pages/main/CallHero.test.tsx` — disabled 어서션을 클릭 → navigate 어서션으로 변경
- `src/pages/main/MainPage.test.tsx` — "통화 버튼은 disabled" 어서션 제거

---

## Task 1: Tailwind 토큰 추가 (boxShadow.orb + breathe/halo/dotBlink keyframes)

**Files:**
- Modify: `tailwind.config.ts`

목업의 인라인 스타일에서 사용한 그림자와 키프레임을 토큰으로 등록한다. UI 코드보다 먼저 추가해서 이후 컴포넌트에서 클래스로 바로 사용한다.

- [ ] **Step 1: `tailwind.config.ts` 수정**

`boxShadow` 객체에 `orb` 항목 추가, `keyframes`와 `animation`에 breathe/halo/dotBlink 항목 추가.

```ts
// tailwind.config.ts (변경 후 발췌)
boxShadow: {
  card: "0 4px 16px rgba(0, 0, 0, 0.04)",
  button: "0 10px 30px rgba(31, 191, 146, 0.35)",
  nav: "0 -2px 20px rgba(0, 0, 0, 0.04)",
  ctrl: "0 8px 24px rgba(0, 0, 0, 0.08)",
  end: "0 12px 28px rgba(255, 131, 100, 0.4)",
  orb: "0 20px 50px rgba(31, 191, 146, 0.25)",
},
keyframes: {
  "pulse-ring": {
    "0%": { transform: "scale(0.92)", opacity: "0.18" },
    "85%": { opacity: "0" },
    "100%": { transform: "scale(1.08)", opacity: "0" },
  },
  breathe: {
    "0%, 100%": { transform: "scale(0.97)" },
    "50%": { transform: "scale(1.05)" },
  },
  halo: {
    "0%, 100%": { transform: "scale(0.95)", opacity: "0.55" },
    "50%": { transform: "scale(1.08)", opacity: "0.85" },
  },
  "dot-blink": {
    "0%, 80%, 100%": { opacity: "0.25", transform: "translateY(0)" },
    "40%": { opacity: "1", transform: "translateY(-3px)" },
  },
},
animation: {
  "pulse-ring": "pulse-ring 4.5s ease-out infinite",
  breathe: "breathe 3.6s ease-in-out infinite",
  halo: "halo 3.6s ease-in-out infinite",
  "dot-blink": "dot-blink 1.4s ease-in-out infinite",
},
```

- [ ] **Step 2: 타입체크와 빌드 확인**

Run: `npm run typecheck`
Expected: 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add tailwind.config.ts
git commit -m "chore: 매칭 페이지용 tailwind 토큰 추가 (orb shadow, breathe/halo/dot-blink)"
```

---

## Task 2: Icebreaker 도메인 타입

**Files:**
- Create: `src/domains/icebreaker/types.ts`

타입은 백엔드 응답 스키마 그대로. 별도 테스트 없음.

- [ ] **Step 1: 타입 파일 생성**

```ts
// src/domains/icebreaker/types.ts
export type Icebreaker = {
  id: number;
  expression: string;
  meaning: string;
  createdAt: string;
};
```

- [ ] **Step 2: 타입체크**

Run: `npm run typecheck`
Expected: 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add src/domains/icebreaker/types.ts
git commit -m "feat: icebreaker 도메인 타입 정의"
```

---

## Task 3: MSW 핸들러 추가 (`/icebreakers`)

**Files:**
- Modify: `test/msw/handlers.ts`

이후 단계의 모든 테스트가 의존하므로 먼저 핸들러를 추가한다.

- [ ] **Step 1: 핸들러 추가**

`test/msw/handlers.ts`의 `handlers` 배열 마지막에 다음을 추가.

```ts
http.get(`${env.apiBaseUrl}/icebreakers`, ({ request }) => {
  const url = new URL(request.url);
  const count = Number(url.searchParams.get("count") ?? "5");
  const items = Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    expression: `Sample expression ${i + 1}`,
    meaning: `샘플 표현 ${i + 1}`,
    createdAt: "2026-04-28T22:34:56.123456",
  }));
  return HttpResponse.json({
    data: { items },
    status: 200,
    message: "OK",
  });
}),
```

- [ ] **Step 2: 기존 테스트가 깨지지 않는지 확인**

Run: `npm run test:run`
Expected: 기존 테스트 모두 통과 (이 핸들러는 새 경로라 영향 없음).

- [ ] **Step 3: 커밋**

```bash
git add test/msw/handlers.ts
git commit -m "test: /icebreakers MSW 핸들러 추가"
```

---

## Task 4: `fetchRandomIcebreakers` API 함수

**Files:**
- Create: `src/domains/icebreaker/api/icebreakerApi.ts`
- Test: `src/domains/icebreaker/api/icebreakerApi.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// src/domains/icebreaker/api/icebreakerApi.test.ts
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "../../../../test/msw/server";
import { fetchRandomIcebreakers } from "./icebreakerApi";

describe("icebreakerApi", () => {
  it("기본 count(5)로 호출하면 5개의 아이스브레이커 배열을 반환한다", async () => {
    const result = await fetchRandomIcebreakers();

    expect(result).toHaveLength(5);
    expect(result[0]).toMatchObject({
      id: expect.any(Number),
      expression: expect.any(String),
      meaning: expect.any(String),
    });
  });

  it("count 파라미터를 query string 으로 전달한다", async () => {
    let receivedCount: string | null = null;
    server.use(
      http.get("http://localhost:3000/icebreakers", ({ request }) => {
        receivedCount = new URL(request.url).searchParams.get("count");
        return HttpResponse.json({
          data: { items: [] },
          status: 200,
          message: "OK",
        });
      }),
    );

    await fetchRandomIcebreakers(3);

    expect(receivedCount).toBe("3");
  });

  it("500 응답이면 ApiError 를 throw 한다", async () => {
    server.use(
      http.get("http://localhost:3000/icebreakers", () =>
        HttpResponse.json(
          { data: null, status: 500, message: "ICEBREAKER_FETCH_FAILED" },
          { status: 500 },
        ),
      ),
    );

    await expect(fetchRandomIcebreakers()).rejects.toThrow(
      "ICEBREAKER_FETCH_FAILED",
    );
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm run test:run -- src/domains/icebreaker/api/icebreakerApi.test.ts`
Expected: FAIL — 모듈/함수 없음.

- [ ] **Step 3: 최소 구현**

```ts
// src/domains/icebreaker/api/icebreakerApi.ts
import { httpGet } from "@/lib/http";
import type { Icebreaker } from "../types";

type IcebreakerListResponse = { items: Icebreaker[] };

export const fetchRandomIcebreakers = async (
  count = 5,
): Promise<Icebreaker[]> => {
  const params = new URLSearchParams({ count: String(count) });
  const res = await httpGet<IcebreakerListResponse>(
    `/icebreakers?${params.toString()}`,
  );
  return res.items;
};
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm run test:run -- src/domains/icebreaker/api/icebreakerApi.test.ts`
Expected: 3 tests PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/domains/icebreaker/api/icebreakerApi.ts src/domains/icebreaker/api/icebreakerApi.test.ts
git commit -m "feat: fetchRandomIcebreakers API 함수 추가"
```

---

## Task 5: `useRandomIcebreakers` 쿼리 훅

**Files:**
- Create: `src/domains/icebreaker/hooks/useRandomIcebreakers.ts`
- Test: `src/domains/icebreaker/hooks/useRandomIcebreakers.test.tsx`

- [ ] **Step 1: 실패하는 테스트 작성**

```tsx
// src/domains/icebreaker/hooks/useRandomIcebreakers.test.tsx
import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { server } from "../../../../test/msw/server";
import { createTestQueryClient } from "../../../../test/utils/renderWithQueryClient";
import { useRandomIcebreakers } from "./useRandomIcebreakers";

const wrapper = ({ children }: { children: ReactNode }) => {
  const queryClient = createTestQueryClient();
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useRandomIcebreakers", () => {
  it("성공 시 5개 아이스브레이커 배열을 data 로 반환한다", async () => {
    const { result } = renderHook(() => useRandomIcebreakers(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(5);
  });

  it("500 응답이면 isError 가 true 다", async () => {
    server.use(
      http.get("http://localhost:3000/icebreakers", () =>
        HttpResponse.json(
          { data: null, status: 500, message: "fail" },
          { status: 500 },
        ),
      ),
    );

    const { result } = renderHook(() => useRandomIcebreakers(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm run test:run -- src/domains/icebreaker/hooks/useRandomIcebreakers.test.tsx`
Expected: FAIL — 훅 없음.

- [ ] **Step 3: 최소 구현**

```ts
// src/domains/icebreaker/hooks/useRandomIcebreakers.ts
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { fetchRandomIcebreakers } from "../api/icebreakerApi";
import type { Icebreaker } from "../types";

const DEFAULT_COUNT = 5;

export function useRandomIcebreakers(
  count: number = DEFAULT_COUNT,
): UseQueryResult<Icebreaker[], Error> {
  return useQuery({
    queryKey: ["icebreakers", "random", count],
    queryFn: () => fetchRandomIcebreakers(count),
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
  });
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm run test:run -- src/domains/icebreaker/hooks/useRandomIcebreakers.test.tsx`
Expected: 2 tests PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/domains/icebreaker/hooks/useRandomIcebreakers.ts src/domains/icebreaker/hooks/useRandomIcebreakers.test.tsx
git commit -m "feat: useRandomIcebreakers 쿼리 훅 추가"
```

---

## Task 6: 폴백 아이스브레이커 상수

**Files:**
- Create: `src/pages/matching/fallbackIcebreakers.ts`

API 응답 전·실패 시에 회전할 폴백 5개 문장. 도메인이 아닌 페이지 폴더에 배치 (스펙 결정 기록 참고).

- [ ] **Step 1: 파일 생성**

```ts
// src/pages/matching/fallbackIcebreakers.ts
import type { Icebreaker } from "@/domains/icebreaker/types";

export const FALLBACK_ICEBREAKERS: Icebreaker[] = [
  {
    id: -1,
    expression: "How's your week going so far?",
    meaning: "이번 주 어떻게 보내고 계세요?",
    createdAt: "",
  },
  {
    id: -2,
    expression: "What brought you to LingRing?",
    meaning: "LingRing은 어떻게 알게 되셨어요?",
    createdAt: "",
  },
  {
    id: -3,
    expression: "Do you have any fun plans this weekend?",
    meaning: "이번 주말에 재미있는 계획 있으세요?",
    createdAt: "",
  },
  {
    id: -4,
    expression: "What's something you've been into lately?",
    meaning: "요즘 빠져 있는 게 있나요?",
    createdAt: "",
  },
  {
    id: -5,
    expression: "Have you been anywhere interesting recently?",
    meaning: "최근에 어디 재밌는 곳 다녀오셨어요?",
    createdAt: "",
  },
];
```

- [ ] **Step 2: 타입체크**

Run: `npm run typecheck`
Expected: 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add src/pages/matching/fallbackIcebreakers.ts
git commit -m "feat: 매칭 페이지 폴백 아이스브레이커 5개 추가"
```

---

## Task 7: `useSentenceRotation` 훅

**Files:**
- Create: `src/pages/matching/useSentenceRotation.ts`
- Test: `src/pages/matching/useSentenceRotation.test.ts`

회전 타이머와 페이드 swap 상태를 관리하는 훅. items 배열이 바뀌어도(폴백 → API 결과) 인덱스는 길이에 맞게 wrap 해서 유지.

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// src/pages/matching/useSentenceRotation.test.ts
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSentenceRotation } from "./useSentenceRotation";

const items = [
  { id: 1, label: "a" },
  { id: 2, label: "b" },
  { id: 3, label: "c" },
];

describe("useSentenceRotation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("초기에는 첫 번째 아이템과 index 0 을 반환한다", () => {
    const { result } = renderHook(() =>
      useSentenceRotation(items, { intervalMs: 1000, fadeMs: 100 }),
    );

    expect(result.current.index).toBe(0);
    expect(result.current.currentItem).toEqual(items[0]);
    expect(result.current.isSwapping).toBe(false);
  });

  it("intervalMs 가 지나면 다음 아이템으로 전환된다", () => {
    const { result } = renderHook(() =>
      useSentenceRotation(items, { intervalMs: 1000, fadeMs: 100 }),
    );

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.isSwapping).toBe(true);

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current.index).toBe(1);
    expect(result.current.currentItem).toEqual(items[1]);
    expect(result.current.isSwapping).toBe(false);
  });

  it("마지막 아이템 다음에는 첫 번째로 wrap 한다", () => {
    const { result } = renderHook(() =>
      useSentenceRotation(items, { intervalMs: 1000, fadeMs: 100 }),
    );

    act(() => {
      vi.advanceTimersByTime((1000 + 100) * 3);
    });

    expect(result.current.index).toBe(0);
  });

  it("items 길이가 줄어들면 index 가 새 길이에 맞게 wrap 된다", () => {
    const { result, rerender } = renderHook(
      ({ list }: { list: typeof items }) =>
        useSentenceRotation(list, { intervalMs: 1000, fadeMs: 100 }),
      { initialProps: { list: items } },
    );

    act(() => {
      vi.advanceTimersByTime((1000 + 100) * 2);
    });
    expect(result.current.index).toBe(2);

    rerender({ list: items.slice(0, 2) });

    expect(result.current.index).toBe(0);
    expect(result.current.currentItem).toEqual(items[0]);
  });

  it("빈 배열이면 currentItem 은 undefined 다", () => {
    const { result } = renderHook(() =>
      useSentenceRotation([], { intervalMs: 1000, fadeMs: 100 }),
    );

    expect(result.current.currentItem).toBeUndefined();
    expect(result.current.index).toBe(0);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm run test:run -- src/pages/matching/useSentenceRotation.test.ts`
Expected: FAIL — 훅 없음.

- [ ] **Step 3: 구현**

```ts
// src/pages/matching/useSentenceRotation.ts
import { useEffect, useRef, useState } from "react";

type Options = {
  intervalMs: number;
  fadeMs: number;
};

type Result<T> = {
  index: number;
  currentItem: T | undefined;
  isSwapping: boolean;
};

export function useSentenceRotation<T>(items: T[], options: Options): Result<T> {
  const { intervalMs, fadeMs } = options;
  const [index, setIndex] = useState(0);
  const [isSwapping, setIsSwapping] = useState(false);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  useEffect(() => {
    if (items.length === 0) {
      setIndex(0);
      return;
    }
    if (index >= items.length) {
      setIndex(0);
    }
  }, [items, index]);

  useEffect(() => {
    if (items.length <= 1) return;

    const cleanups: Array<() => void> = [];

    const intervalId = setInterval(() => {
      setIsSwapping(true);
      const fadeTimeoutId = setTimeout(() => {
        setIndex((prev) => {
          const total = itemsRef.current.length;
          if (total === 0) return 0;
          return (prev + 1) % total;
        });
        setIsSwapping(false);
      }, fadeMs);

      cleanups.push(() => clearTimeout(fadeTimeoutId));
    }, intervalMs);

    return () => {
      clearInterval(intervalId);
      cleanups.forEach((fn) => fn());
    };
  }, [items.length, intervalMs, fadeMs]);

  const safeIndex = items.length === 0 ? 0 : Math.min(index, items.length - 1);

  return {
    index: items.length === 0 ? 0 : safeIndex,
    currentItem: items[safeIndex],
    isSwapping,
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm run test:run -- src/pages/matching/useSentenceRotation.test.ts`
Expected: 5 tests PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/pages/matching/useSentenceRotation.ts src/pages/matching/useSentenceRotation.test.ts
git commit -m "feat: 문장 회전 훅 useSentenceRotation 추가"
```

---

## Task 8: `BreathingOrb` 시각 컴포넌트

**Files:**
- Create: `src/pages/matching/BreathingOrb.tsx`

오브 + halo + 점 3개. 외부 props 없음, 순수 시각 컴포넌트라 별도 단위 테스트 없음 (`MatchingPage` 통합 테스트에서 렌더 여부 확인).

- [ ] **Step 1: 컴포넌트 작성**

```tsx
// src/pages/matching/BreathingOrb.tsx
export function BreathingOrb() {
  return (
    <>
      <div
        aria-hidden="true"
        className="relative mt-3 mb-[22px] flex h-[220px] w-[220px] items-center justify-center"
      >
        <div className="pointer-events-none absolute -inset-[30px] rounded-full bg-[radial-gradient(circle,rgba(31,191,146,0.18)_0%,rgba(31,191,146,0)_70%)] animate-halo" />
        <div className="relative flex h-[160px] w-[160px] items-center justify-center rounded-full bg-gradient-to-br from-mint-300 via-mint-500 to-coral-500 text-white shadow-orb animate-breathe">
          <svg
            viewBox="0 0 24 24"
            className="h-12 w-12"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.72 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0 1 22 16.92z" />
          </svg>
        </div>
      </div>
      <div aria-hidden="true" className="mt-1 mb-3.5 flex gap-1.5">
        <span className="inline-block h-[7px] w-[7px] rounded-full bg-mint-400 animate-dot-blink" />
        <span
          className="inline-block h-[7px] w-[7px] rounded-full bg-mint-400 animate-dot-blink"
          style={{ animationDelay: "0.2s" }}
        />
        <span
          className="inline-block h-[7px] w-[7px] rounded-full bg-mint-400 animate-dot-blink"
          style={{ animationDelay: "0.4s" }}
        />
      </div>
    </>
  );
}
```

- [ ] **Step 2: 타입체크**

Run: `npm run typecheck`
Expected: 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add src/pages/matching/BreathingOrb.tsx
git commit -m "feat: BreathingOrb 시각 컴포넌트 추가"
```

---

## Task 9: `IcebreakerRotator` 컴포넌트

**Files:**
- Create: `src/pages/matching/IcebreakerRotator.tsx`
- Test: `src/pages/matching/IcebreakerRotator.test.tsx`

회전 카드 + 진행 도트.

- [ ] **Step 1: 실패하는 테스트 작성**

```tsx
// src/pages/matching/IcebreakerRotator.test.tsx
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Icebreaker } from "@/domains/icebreaker/types";
import { IcebreakerRotator } from "./IcebreakerRotator";

const sentences: Icebreaker[] = [
  { id: 1, expression: "First en", meaning: "첫번째 한국어", createdAt: "" },
  { id: 2, expression: "Second en", meaning: "두번째 한국어", createdAt: "" },
];

describe("IcebreakerRotator", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("초기에 첫 번째 문장(영어 + 한국어)을 보여준다", () => {
    render(
      <IcebreakerRotator
        sentences={sentences}
        intervalMs={1000}
        fadeMs={100}
      />,
    );

    expect(screen.getByText("First en")).toBeInTheDocument();
    expect(screen.getByText("첫번째 한국어")).toBeInTheDocument();
  });

  it("intervalMs + fadeMs 가 지나면 다음 문장으로 바뀐다", () => {
    render(
      <IcebreakerRotator
        sentences={sentences}
        intervalMs={1000}
        fadeMs={100}
      />,
    );

    act(() => {
      vi.advanceTimersByTime(1000 + 100);
    });

    expect(screen.getByText("Second en")).toBeInTheDocument();
    expect(screen.getByText("두번째 한국어")).toBeInTheDocument();
  });

  it("진행 도트는 sentences 길이만큼 렌더되고 현재 인덱스만 active 다", () => {
    render(
      <IcebreakerRotator
        sentences={sentences}
        intervalMs={1000}
        fadeMs={100}
      />,
    );

    const dots = screen.getAllByTestId("rotator-dot");
    expect(dots).toHaveLength(2);
    expect(dots[0]).toHaveAttribute("data-active", "true");
    expect(dots[1]).toHaveAttribute("data-active", "false");
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm run test:run -- src/pages/matching/IcebreakerRotator.test.tsx`
Expected: FAIL — 모듈 없음.

- [ ] **Step 3: 구현**

```tsx
// src/pages/matching/IcebreakerRotator.tsx
import type { Icebreaker } from "@/domains/icebreaker/types";
import { useSentenceRotation } from "./useSentenceRotation";

type Props = {
  sentences: Icebreaker[];
  intervalMs: number;
  fadeMs: number;
};

export function IcebreakerRotator({ sentences, intervalMs, fadeMs }: Props) {
  const { index, currentItem, isSwapping } = useSentenceRotation(sentences, {
    intervalMs,
    fadeMs,
  });

  return (
    <section className="mt-2 mb-4 w-full" aria-live="polite">
      <p className="mx-1 mb-2.5 flex items-center gap-1.5 text-[12px] font-semibold leading-none text-coral-600">
        <span className="rounded-md bg-coral-100 px-1.5 py-[3px] text-[10px] font-bold tracking-wider text-coral-600">
          TIP
        </span>
        이런 문장으로 시작해보세요
      </p>
      <div className="relative flex min-h-[142px] flex-col justify-center overflow-hidden rounded-lg border border-gray-100 bg-white px-5 py-5 shadow-card">
        <p
          className={`m-0 mb-2 text-[19px] font-bold leading-snug tracking-[-0.01em] text-gray-900 transition-[opacity,transform] duration-[280ms] ease-in-out ${
            isSwapping ? "-translate-y-1.5 opacity-0" : "translate-y-0 opacity-100"
          }`}
        >
          {currentItem?.expression ?? ""}
        </p>
        <p
          className={`m-0 text-[13px] font-medium leading-relaxed text-gray-600 transition-[opacity,transform] duration-[280ms] ease-in-out ${
            isSwapping ? "-translate-y-1.5 opacity-0" : "translate-y-0 opacity-100"
          }`}
        >
          {currentItem?.meaning ?? ""}
        </p>
      </div>
      <div className="mt-3.5 flex justify-center gap-1.5">
        {sentences.map((s, i) => {
          const active = i === index;
          return (
            <span
              key={s.id}
              data-testid="rotator-dot"
              data-active={active}
              className={`h-1.5 rounded-full transition-all duration-200 ease-in-out ${
                active ? "w-[18px] bg-mint-500" : "w-1.5 bg-gray-200"
              }`}
            />
          );
        })}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm run test:run -- src/pages/matching/IcebreakerRotator.test.tsx`
Expected: 3 tests PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/pages/matching/IcebreakerRotator.tsx src/pages/matching/IcebreakerRotator.test.tsx
git commit -m "feat: IcebreakerRotator 회전 카드 컴포넌트 추가"
```

---

## Task 10: `CancelConfirmSheet` 컴포넌트

**Files:**
- Create: `src/pages/matching/CancelConfirmSheet.tsx`

별도 단위 테스트 없이 `MatchingPage` 통합 테스트에서 동작 검증.

- [ ] **Step 1: 컴포넌트 작성**

```tsx
// src/pages/matching/CancelConfirmSheet.tsx
type Props = {
  open: boolean;
  onKeep: () => void;
  onCancel: () => void;
};

export function CancelConfirmSheet({ open, onKeep, onCancel }: Props) {
  return (
    <>
      <button
        type="button"
        aria-label="시트 닫기"
        aria-hidden={!open}
        onClick={onKeep}
        tabIndex={open ? 0 : -1}
        className={`absolute inset-0 z-10 cursor-default bg-black/35 transition-opacity duration-200 ${
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-sheet-title"
        aria-hidden={!open}
        className={`absolute inset-x-0 bottom-0 z-[11] rounded-t-3xl bg-white px-5 pb-7 pt-6 shadow-[0_-10px_40px_rgba(0,0,0,0.15)] transition-transform duration-300 ease-out ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <h3
          id="cancel-sheet-title"
          className="m-0 mb-1 text-center text-[17px] font-bold leading-snug text-gray-900"
        >
          매칭을 취소할까요?
        </h3>
        <p className="m-0 mb-4 text-center text-[13px] font-medium leading-relaxed text-gray-600">
          조금만 더 기다리면 만날 수 있어요
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onKeep}
            className="flex-1 rounded-2xl bg-gray-100 py-3.5 text-[15px] font-bold leading-none tracking-[-0.01em] text-gray-800 active:scale-[0.98]"
          >
            계속 기다리기
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-2xl bg-gray-900 py-3.5 text-[15px] font-bold leading-none tracking-[-0.01em] text-white active:scale-[0.98]"
          >
            취소하기
          </button>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: 타입체크**

Run: `npm run typecheck`
Expected: 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add src/pages/matching/CancelConfirmSheet.tsx
git commit -m "feat: 매칭 취소 확인 바텀시트 컴포넌트 추가"
```

---

## Task 11: `MatchingPage` 통합 + 라우트 등록

**Files:**
- Create: `src/pages/matching/MatchingPage.tsx`
- Test: `src/pages/matching/MatchingPage.test.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: 실패하는 테스트 작성**

```tsx
// src/pages/matching/MatchingPage.test.tsx
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { server } from "../../../test/msw/server";
import { renderWithQueryClient } from "../../../test/utils/renderWithQueryClient";
import { MatchingPage } from "./MatchingPage";

describe("MatchingPage", () => {
  it("상단 타이틀 '매칭 중' 과 안내 문구를 보여준다", () => {
    renderWithQueryClient(<MatchingPage />);

    expect(screen.getByText("매칭 중")).toBeInTheDocument();
    expect(
      screen.getByText("대화할 사람을 찾고 있어요"),
    ).toBeInTheDocument();
  });

  it("API 응답 전이라도 폴백 문장을 카드에 보여준다", () => {
    renderWithQueryClient(<MatchingPage />);

    expect(
      screen.getByText("How's your week going so far?"),
    ).toBeInTheDocument();
  });

  it("API 가 실패해도 폴백 문장으로 회전이 유지된다", async () => {
    server.use(
      http.get("http://localhost:3000/icebreakers", () =>
        HttpResponse.json(
          { data: null, status: 500, message: "fail" },
          { status: 500 },
        ),
      ),
    );

    renderWithQueryClient(<MatchingPage />);

    expect(
      screen.getByText("How's your week going so far?"),
    ).toBeInTheDocument();
  });

  it("닫기 버튼을 누르면 취소 시트가 열린다", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<MatchingPage />);

    await user.click(screen.getByRole("button", { name: "닫기" }));

    expect(
      screen.getByRole("dialog", { name: "매칭을 취소할까요?" }),
    ).toBeInTheDocument();
  });

  it("'계속 기다리기'를 누르면 시트가 닫힌다", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<MatchingPage />);

    await user.click(screen.getByRole("button", { name: "매칭 취소" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).not.toHaveAttribute("aria-hidden", "true");

    await user.click(screen.getByRole("button", { name: "계속 기다리기" }));

    await waitFor(() =>
      expect(screen.getByRole("dialog")).toHaveAttribute("aria-hidden", "true"),
    );
  });

  it("'취소하기' 를 누르면 / 로 navigate 한다", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(
      <Routes>
        <Route path="/matching" element={<MatchingPage />} />
        <Route path="/" element={<div>메인 화면</div>} />
      </Routes>,
      { initialEntries: ["/matching"] },
    );

    await user.click(screen.getByRole("button", { name: "매칭 취소" }));
    await user.click(screen.getByRole("button", { name: "취소하기" }));

    expect(await screen.findByText("메인 화면")).toBeInTheDocument();
  });
});
```

> 마지막 테스트는 `<Routes>` 로 실제 라우팅을 구성해서 navigate 결과까지 검증한다. `Route`/`Routes` import 를 파일 상단에 추가:
>
> ```ts
> import { Route, Routes } from "react-router-dom";
> ```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm run test:run -- src/pages/matching/MatchingPage.test.tsx`
Expected: FAIL — 컴포넌트 없음.

- [ ] **Step 3: `MatchingPage` 구현**

```tsx
// src/pages/matching/MatchingPage.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
  const [sheetOpen, setSheetOpen] = useState(false);
  const { data } = useRandomIcebreakers(ICEBREAKER_COUNT);

  const sentences = data ?? FALLBACK_ICEBREAKERS;

  const openSheet = () => setSheetOpen(true);
  const closeSheet = () => setSheetOpen(false);
  const handleCancel = () => {
    setSheetOpen(false);
    navigate("/");
  };

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

- [ ] **Step 4: `App.tsx` 라우트 등록**

`src/App.tsx`를 다음과 같이 수정:

```tsx
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { QueryProvider } from "@/providers/QueryProvider";
import { MainPage } from "@/pages/main/MainPage";
import { MatchingPage } from "@/pages/matching/MatchingPage";
import { MyPagePage } from "@/pages/mypage/MyPagePage";
import { UserExpressionsPage } from "@/pages/userExpressions/UserExpressionsPage";

export default function App() {
  return (
    <QueryProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<MainPage />} />
          <Route path="/matching" element={<MatchingPage />} />
          <Route path="/mypage" element={<MyPagePage />} />
          <Route path="/expressions" element={<UserExpressionsPage />} />
        </Routes>
      </BrowserRouter>
    </QueryProvider>
  );
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npm run test:run -- src/pages/matching/MatchingPage.test.tsx`
Expected: 6 tests PASS.

- [ ] **Step 6: 커밋**

```bash
git add src/pages/matching/MatchingPage.tsx src/pages/matching/MatchingPage.test.tsx src/App.tsx
git commit -m "feat: MatchingPage 추가 및 /matching 라우트 등록"
```

---

## Task 12: `CallHero` 활성화 + `/matching` 네비게이션

**Files:**
- Modify: `src/pages/main/CallHero.tsx`
- Modify: `src/pages/main/CallHero.test.tsx`
- Modify: `src/pages/main/MainPage.test.tsx`

기존 disabled 상태를 풀고 클릭 시 `/matching`으로 이동.

- [ ] **Step 1: `CallHero.test.tsx` 수정 — disabled 어서션 → navigate 어서션**

```tsx
// src/pages/main/CallHero.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { CallHero } from "./CallHero";

describe("CallHero", () => {
  it("힌트 문구 두 줄과 통화 시작 버튼을 렌더한다", () => {
    render(
      <MemoryRouter>
        <CallHero />
      </MemoryRouter>,
    );

    expect(
      screen.getByText("오늘은 누구와 만나게 될까요?"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("버튼을 눌러 랜덤 매칭을 시작해요"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "통화 시작하기" }),
    ).toBeInTheDocument();
  });

  it("통화 시작 버튼을 누르면 /matching 으로 이동한다", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<CallHero />} />
          <Route path="/matching" element={<div>매칭 화면</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "통화 시작하기" }));

    expect(screen.getByText("매칭 화면")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm run test:run -- src/pages/main/CallHero.test.tsx`
Expected: FAIL — 두 번째 테스트가 실패 (버튼이 disabled).

- [ ] **Step 3: `CallHero` 구현 변경 — `useNavigate` + 클릭 핸들러**

```tsx
// src/pages/main/CallHero.tsx
import { useNavigate } from "react-router-dom";

export function CallHero() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-1 flex-col items-center justify-center pb-[30px]">
      <p className="m-0 mb-1.5 text-[15px] font-semibold text-gray-700">
        오늘은 누구와 만나게 될까요?
      </p>
      <p className="m-0 mb-6 text-[13px] font-medium text-gray-500">
        버튼을 눌러 랜덤 매칭을 시작해요
      </p>

      <div className="relative flex h-[220px] w-[220px] items-center justify-center">
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-full bg-mint-200 opacity-0 animate-pulse-ring"
        />
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-full bg-mint-200 opacity-0 animate-pulse-ring"
          style={{ animationDelay: "1.5s" }}
        />
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-full bg-mint-200 opacity-0 animate-pulse-ring"
          style={{ animationDelay: "3s" }}
        />

        <button
          type="button"
          aria-label="통화 시작하기"
          onClick={() => navigate("/matching")}
          className="relative z-[1] flex h-[160px] w-[160px] cursor-pointer flex-col items-center justify-center gap-2 rounded-full border-0 bg-gradient-to-br from-mint-400 via-mint-500 to-coral-500 text-white shadow-button transition-transform active:scale-95"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-12 w-12"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.72 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0 1 22 16.92z" />
          </svg>
          <span className="text-[17px] font-bold leading-none tracking-[-0.01em]">
            통화 시작하기
          </span>
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: `CallHero` 테스트 통과 확인**

Run: `npm run test:run -- src/pages/main/CallHero.test.tsx`
Expected: 2 tests PASS.

- [ ] **Step 5: `MainPage.test.tsx` 의 disabled 어서션 제거**

`src/pages/main/MainPage.test.tsx`의 마지막 케이스 ("표현 카드·통화 버튼은 disabled 이고…") 에서 통화 버튼 disabled 어서션을 제거. 변경 전:

```ts
expect(
  screen.getByRole("button", { name: "통화 시작하기" }),
).toBeDisabled();
expect(
  screen.getByRole("button", { name: "오늘의 표현 자세히 보기" }),
).toBeDisabled();
```

변경 후:

```ts
expect(
  screen.getByRole("button", { name: "오늘의 표현 자세히 보기" }),
).toBeDisabled();
```

또한 케이스 제목도 "표현 카드는 disabled 이고, 하단 탭의 홈은 활성 상태다" 로 수정.

- [ ] **Step 6: 전체 메인 페이지 테스트 통과 확인**

Run: `npm run test:run -- src/pages/main`
Expected: 모든 테스트 PASS.

- [ ] **Step 7: 커밋**

```bash
git add src/pages/main/CallHero.tsx src/pages/main/CallHero.test.tsx src/pages/main/MainPage.test.tsx
git commit -m "feat: 통화 시작 버튼 활성화 및 /matching 네비게이션 연결"
```

---

## Task 13: 최종 검증

**Files:** 없음 (검증만)

전체 타입체크 / 린트 / 테스트 / 커버리지 확인.

- [ ] **Step 1: 타입체크**

Run: `npm run typecheck`
Expected: 에러 없음.

- [ ] **Step 2: 린트**

Run: `npm run lint`
Expected: 경고/에러 없음.

- [ ] **Step 3: 전체 테스트**

Run: `npm run test:run`
Expected: 모든 테스트 PASS.

- [ ] **Step 4: 커버리지 80%+ 확인**

Run: `npm run coverage`
Expected: lines/branches/functions/statements 모두 80% 이상.

- [ ] **Step 5: 개발 서버에서 수동 확인**

Run: `npm run dev`
브라우저에서:
1. 메인 페이지 로드 → 통화 시작 버튼 클릭 → `/matching` 진입
2. 카드에서 7초 간격으로 문장이 페이드 전환되는지 확인
3. 진행 도트의 active 위치가 같이 이동하는지 확인
4. 닫기(✕) 또는 매칭 취소 버튼 → 시트 → "계속 기다리기" → 시트 닫힘
5. 다시 시트 열고 "취소하기" → `/` 메인 복귀

수동 검증이므로 통과/실패만 본인이 판단.

- [ ] **Step 6: 변경 없는 빈 커밋 만들지 않음**

이미 모든 변경은 이전 태스크에서 커밋됨. 마지막 커밋 메시지 점검만:

Run: `git log --oneline -15`
Expected: Task 1~12 의 커밋이 순서대로 보인다.

---

## 체크리스트 (스펙 ↔ 계획 매핑)

| 스펙 항목 | 대응 태스크 |
| --- | --- |
| `/matching` 라우트 추가 | Task 11 Step 4 |
| `BreathingOrb` 시각 컴포넌트 | Task 8 |
| `IcebreakerRotator` 회전 카드 | Task 9 |
| `useSentenceRotation` 훅 (회전 + 페이드) | Task 7 |
| `useRandomIcebreakers` 훅 (`staleTime: 0`, `gcTime: 0`) | Task 5 |
| `fetchRandomIcebreakers` API + 응답 unwrap | Task 4 |
| 폴백 5개 문장 (`pages/matching/` 위치) | Task 6 |
| `CancelConfirmSheet` (취소 시트) | Task 10 |
| 메인 통화 버튼 활성화 + navigate | Task 12 |
| Tailwind 토큰 (orb shadow, breathe/halo/dot-blink) | Task 1 |
| MSW `/icebreakers` 핸들러 | Task 3 |
| API 실패해도 폴백으로 회전 | Task 11 통합 테스트 |
| 매직 넘버 named const (`ICEBREAKER_COUNT`, `ROTATION_INTERVAL_MS`, `FADE_MS`) | Task 11 Step 3 |
| 커버리지 80%+ | Task 13 Step 4 |
