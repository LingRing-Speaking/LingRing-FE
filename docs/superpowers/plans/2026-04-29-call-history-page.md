# 통화 기록 페이지 구현 계획 (Call History Page Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `lingring_history.html` 목업을 따르는 통화 기록 페이지를 구현하고, 백엔드 API가 없는 상황에서 dev 환경의 MSW 브라우저 worker로 동작하게 한다.

**Architecture:** 도메인 (`src/domains/callHistory/`)이 데이터·API·훅, 페이지 (`src/pages/callHistory/`)가 표시·시간 그룹핑·UI 책임. MSW 핸들러를 `test/msw/`에서 `src/mocks/`로 이동해 dev/test 공용으로 만들고, `VITE_MSW=on`일 때 dev에서 worker가 켜진다. 무한 스크롤은 기존 `useUserExpressions` 패턴(`useInfiniteQuery + hasNext`)을 재사용.

**Tech Stack:** React 18 · TypeScript · Vite · Tailwind · React Router v7 · TanStack Query · MSW · Vitest · Testing Library

**Spec:** `docs/superpowers/specs/2026-04-29-call-history-page-design.md`

**대응 GitHub 이슈:** [#21](https://github.com/LingRing-Speaking/FE/issues/21)

---

## 파일 구조 요약

### 신규 파일

```
src/domains/callHistory/
├── types.ts
├── api/
│   ├── callHistoryApi.ts
│   └── callHistoryApi.test.ts
└── hooks/
    ├── useCallHistory.ts
    └── useCallHistory.test.tsx

src/pages/callHistory/
├── CallHistoryPage.tsx
├── CallHistoryPage.test.tsx
├── CallHistoryList.tsx
├── CallHistoryList.test.tsx
├── CallCard.tsx
├── CallCard.test.tsx
├── EmptyCallHistory.tsx
├── EmptyCallHistory.test.tsx
├── timeBucket.ts
└── timeBucket.test.ts

src/mocks/                              # ← test/msw/에서 이동
├── handlers.ts
├── server.ts
└── browser.ts                          # NEW

public/mockServiceWorker.js             # NEW (npx msw init)
```

### 수정되는 기존 파일

- `src/App.tsx` — `/history` 라우트 추가
- `src/main.tsx` — 조건부 worker 부트스트랩
- `src/components/BottomTabBar.tsx` — 대화 기록 탭을 `<Link to="/history">`로 활성화
- `test/setup.ts` — MSW import 경로 갱신
- `.env.example` — `VITE_MSW=off` 추가
- 기존 14개 테스트 파일 — `test/msw/server` import 경로 갱신 (Task 1에서 한 번에)

---

## Task 1: MSW 핸들러를 `src/mocks/`로 이동

dev/test 공용으로 쓰려면 `src/` 안에 있어야 Vite가 번들에 포함시킨다. 행동 변화는 0 — 위치와 import 경로만 바꾸는 순수 리팩토링.

**Files:**
- Move: `test/msw/handlers.ts` → `src/mocks/handlers.ts`
- Move: `test/msw/server.ts` → `src/mocks/server.ts`
- Modify: `test/setup.ts` (import 경로)
- Modify: 14개 테스트 파일의 `test/msw/server` import (아래 Step 3 목록 참고)

- [ ] **Step 1: 디렉토리 생성 + 파일 이동 (git mv로 히스토리 보존)**

```bash
mkdir -p src/mocks
git mv test/msw/handlers.ts src/mocks/handlers.ts
git mv test/msw/server.ts src/mocks/server.ts
rmdir test/msw
```

- [ ] **Step 2: `test/setup.ts` import 경로 변경**

`test/setup.ts`의 line 3을 변경한다.

```ts
// 변경 전
import { server } from "./msw/server";

// 변경 후
import { server } from "@/mocks/server";
```

- [ ] **Step 3: 14개 테스트 파일의 import 경로를 `@/mocks/server`로 일괄 변경**

대상 파일 (이 시점에 `grep -rn "test/msw/server" src test`로 다시 확인):

```
src/domains/matching/hooks/useEnterMatchingQueue.test.tsx
src/domains/matching/hooks/useMatchingStatus.test.tsx
src/domains/icebreaker/hooks/useRandomIcebreakers.test.tsx
src/domains/matching/api/matchingApi.test.ts
src/domains/icebreaker/api/icebreakerApi.test.ts
src/domains/user/hooks/useUserMy.test.tsx
src/domains/userExpression/hooks/useUserExpressions.test.tsx
src/domains/recommendedExpression/hooks/useDailyRecommendedExpression.test.tsx
src/domains/recommendedExpression/api/recommendedExpressionApi.test.ts
src/lib/http.test.ts
src/pages/matching/MatchingPage.test.tsx
src/pages/mypage/MyPagePage.test.tsx
src/pages/userExpressions/UserExpressionsPage.test.tsx
src/pages/main/MainPage.test.tsx
```

각 파일에서 `from "../../../../test/msw/server"` 또는 `from "../../../test/msw/server"` 또는 `from "../../test/msw/server"` 같은 상대경로를 모두 `from "@/mocks/server"`로 통일한다.

빠른 일괄 치환:

```bash
# macOS sed
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' -E 's|from "(\.\./)+test/msw/server"|from "@/mocks/server"|g' {} +
```

- [ ] **Step 4: 타입체크와 전체 테스트 실행 — 모두 통과해야 함**

```bash
npm run typecheck && npm run test:run
```

Expected: 타입체크 PASS, 모든 테스트 PASS (변화 없음).

- [ ] **Step 5: 커밋**

```bash
git add -A
git commit -m "$(cat <<'EOF'
chore: MSW 핸들러를 src/mocks/ 로 이동

dev/test 공용 사용을 위해 test/msw/ 에서 src/mocks/ 로 위치를 옮긴다.
import 경로는 @/mocks/* 로 통일.
EOF
)"
```

---

## Task 2: 브라우저용 MSW worker 부트스트랩 추가

`VITE_MSW=on`일 때만 dev 빌드에서 worker가 켜진다. prod 빌드는 dynamic import 가드로 번들에 포함되지 않는다.

**Files:**
- Create: `public/mockServiceWorker.js` (msw init이 생성)
- Create: `src/mocks/browser.ts`
- Modify: `src/main.tsx`
- Modify: `.env.example`

- [ ] **Step 1: MSW worker 정적 파일 생성**

```bash
npx msw init public/ --save
```

생성된 `public/mockServiceWorker.js`를 git에 포함한다 (MSW 표준 — 빌드 산출물 아님).

- [ ] **Step 2: `src/mocks/browser.ts` 작성**

```ts
import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

export const worker = setupWorker(...handlers);
```

- [ ] **Step 3: `src/main.tsx` 수정 — 조건부 worker 시작**

기존 파일을 다음으로 교체한다.

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("#root element not found");

async function startMockWorker() {
  if (!import.meta.env.DEV) return;
  if (import.meta.env.VITE_MSW !== "on") return;
  const { worker } = await import("./mocks/browser");
  await worker.start({ onUnhandledRequest: "bypass" });
}

startMockWorker().then(() => {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
```

`onUnhandledRequest: "bypass"` 는 mock 안 만든 엔드포인트는 진짜 BE로 흘려보낸다 (부분 mock 가능).

- [ ] **Step 4: `.env.example` 에 `VITE_MSW` 옵션 추가**

기존 내용 끝에 다음 두 줄을 추가한다.

```
# 개발 중에 백엔드 mock(MSW)을 켜려면 on. 평소엔 off로 진짜 BE 호출.
VITE_MSW=off
```

- [ ] **Step 5: 타입체크 + 빌드 + 전체 테스트**

```bash
npm run typecheck && npm run build && npm run test:run
```

Expected: 모두 PASS. `dist/`에 `mockServiceWorker.js`가 복사되는지 확인 (`public/`은 자동으로 `dist/`로 복사됨).

- [ ] **Step 6: 커밋**

```bash
git add public/mockServiceWorker.js src/mocks/browser.ts src/main.tsx .env.example
git commit -m "$(cat <<'EOF'
chore: dev MSW 브라우저 worker 부트스트랩 추가

VITE_MSW=on 일 때만 dev 모드에서 worker 가 시작된다.
dynamic import 가드로 prod 번들에는 포함되지 않는다.
EOF
)"
```

---

## Task 3: 통화 기록 도메인 타입 정의

**Files:**
- Create: `src/domains/callHistory/types.ts`

- [ ] **Step 1: `src/domains/callHistory/types.ts` 작성**

```ts
export type CallHistoryItem = {
  id: number;
  partner: { id: number; name: string };
  startedAt: string; // ISO 8601 (예: "2026-04-29T19:30:00+09:00")
  durationSec: number;
  analyzed: boolean;
};

export type CallHistoryList = {
  items: CallHistoryItem[];
  hasNext: boolean;
};
```

- [ ] **Step 2: 타입체크**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: 커밋**

```bash
git add src/domains/callHistory/types.ts
git commit -m "feat: 통화 기록 도메인 타입 정의"
```

---

## Task 4: MSW 통화 기록 핸들러 + 시드 생성기 추가

dev에서 페이지를 띄웠을 때 자연스러운 그룹 분포를 보려면 시드 데이터가 `now` 기준 상대 시간이어야 한다. 같은 핸들러를 테스트(server)와 dev(browser)가 공유한다.

**Files:**
- Modify: `src/mocks/handlers.ts`

- [ ] **Step 1: `src/mocks/handlers.ts` 끝에 핸들러 + 시드 생성기 추가**

기존 `handlers` 배열의 마지막 항목(`http.delete(... matching ...)`) 다음에 통화 기록 핸들러를 추가한다. 파일 상단 import는 변경 없음.

`handlers` 배열 안 마지막 entry로 다음을 추가:

```ts
  http.get(`${env.apiBaseUrl}/users/:userId/calls`, ({ request, params }) => {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get("page") ?? 0);
    const size = Number(url.searchParams.get("size") ?? 20);
    const userId = Number(params.userId);
    const all = generateFakeCalls(userId, 50);
    const slice = all.slice(page * size, page * size + size);
    return HttpResponse.json({
      data: { items: slice, hasNext: (page + 1) * size < all.length },
      status: 200,
      message: "OK",
    });
  }),
```

`handlers` 배열 정의 위(파일 상단의 import 아래, `export const handlers` 위) 에 시드 생성기를 추가:

```ts
import type { CallHistoryItem } from "@/domains/callHistory/types";

const FAKE_PARTNER_NAMES = [
  "Jenson", "Minji", "Sophie", "David", "Emma", "Daniel", "Hannah",
  "Olivia", "Noah", "Amelia", "Liam", "Yujin", "Sora", "Junho",
];

// 0~480시간 전 사이에서 50개의 통화를 분산 배치.
// 매일 자동으로 오늘/이번 주/이번 달/지난 달들에 분포가 갱신됨.
function generateFakeCalls(userId: number, n: number): CallHistoryItem[] {
  const now = Date.now();
  return Array.from({ length: n }, (_, i) => {
    // 비선형 분포: 처음 몇 개는 오늘/이번 주에 몰리고, 뒤로 갈수록 멀어진다.
    const hoursAgo = Math.round((i * i) / 2 + i * 2);
    const startedAt = new Date(now - hoursAgo * 3600_000).toISOString();
    const durationSec = 60 + ((i * 37) % 540); // 1:00 ~ 9:59
    return {
      id: i + 1,
      partner: {
        id: 1000 + i,
        name: FAKE_PARTNER_NAMES[i % FAKE_PARTNER_NAMES.length] ?? "Friend",
      },
      startedAt,
      durationSec,
      analyzed: i % 3 !== 0, // 3개 중 1개는 미분석 → "분석하기" 버튼이 골고루 노출
    };
  });
}
```

`userId` 인자는 partner.id가 사용자별로 다르게 보이게 하기 위해 받지만, 시드에는 직접 영향 없음 (확장 여지).

- [ ] **Step 2: 타입체크 + 테스트 — 핸들러 추가만으로는 회귀 없어야 함**

```bash
npm run typecheck && npm run test:run
```

Expected: PASS.

- [ ] **Step 3: 커밋**

```bash
git add src/mocks/handlers.ts
git commit -m "$(cat <<'EOF'
chore: 통화 기록 mock 핸들러 + 시드 생성기 추가

GET /users/:userId/calls 핸들러와 50건 시드 생성기를 추가한다.
시드는 now 기준 상대 시간이라 매일 자동으로 그룹 분포가 갱신된다.
EOF
)"
```

---

## Task 5: API 함수 `fetchCallHistory` (TDD)

**Files:**
- Create: `src/domains/callHistory/api/callHistoryApi.ts`
- Create: `src/domains/callHistory/api/callHistoryApi.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/domains/callHistory/api/callHistoryApi.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { fetchCallHistory } from "./callHistoryApi";

describe("callHistoryApi", () => {
  it("fetchCallHistory 는 /users/:id/calls?page=&size= 를 호출해 items, hasNext 를 반환한다", async () => {
    const result = await fetchCallHistory(1, 0, 20);

    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items[0]).toMatchObject({
      id: expect.any(Number),
      partner: { id: expect.any(Number), name: expect.any(String) },
      startedAt: expect.any(String),
      durationSec: expect.any(Number),
      analyzed: expect.any(Boolean),
    });
    expect(typeof result.hasNext).toBe("boolean");
  });

  it("page 와 size 파라미터에 따라 다른 결과를 받는다", async () => {
    const first = await fetchCallHistory(1, 0, 5);
    const second = await fetchCallHistory(1, 1, 5);

    expect(first.items).toHaveLength(5);
    expect(second.items).toHaveLength(5);
    expect(first.items[0]?.id).not.toBe(second.items[0]?.id);
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
npm run test:run -- callHistoryApi
```

Expected: FAIL ("Cannot find module './callHistoryApi'" 또는 유사 에러).

- [ ] **Step 3: 최소 구현 작성**

`src/domains/callHistory/api/callHistoryApi.ts`:

```ts
import { httpGet } from "@/lib/http";
import type { CallHistoryList } from "../types";

export const fetchCallHistory = (
  userId: number,
  page: number,
  size: number,
): Promise<CallHistoryList> =>
  httpGet<CallHistoryList>(
    `/users/${userId}/calls?page=${page}&size=${size}`,
  );
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npm run test:run -- callHistoryApi
```

Expected: PASS (2 tests).

- [ ] **Step 5: 커밋**

```bash
git add src/domains/callHistory/api
git commit -m "feat: 통화 기록 API 함수 추가"
```

---

## Task 6: `useCallHistory` 무한 쿼리 훅 (TDD)

기존 `useUserExpressions` 와 동일한 패턴.

**Files:**
- Create: `src/domains/callHistory/hooks/useCallHistory.ts`
- Create: `src/domains/callHistory/hooks/useCallHistory.test.tsx`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/domains/callHistory/hooks/useCallHistory.test.tsx`:

```tsx
import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { server } from "@/mocks/server";
import { createTestQueryClient } from "../../../../test/utils/renderWithQueryClient";
import { useCallHistory } from "./useCallHistory";

const wrapper = ({ children }: { children: ReactNode }) => {
  const queryClient = createTestQueryClient();
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useCallHistory", () => {
  it("첫 페이지 성공 시 pages[0].items 를 반환한다", async () => {
    const { result } = renderHook(() => useCallHistory(1), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.pages[0]?.items.length).toBeGreaterThan(0);
  });

  it("hasNext 가 false 면 hasNextPage 도 false 다", async () => {
    server.use(
      http.get("http://localhost:3000/users/1/calls", () =>
        HttpResponse.json({
          data: { items: [], hasNext: false },
          status: 200,
          message: "OK",
        }),
      ),
    );

    const { result } = renderHook(() => useCallHistory(1), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(false);
  });

  it("fetchNextPage 를 호출하면 두 번째 페이지가 누적된다", async () => {
    server.use(
      http.get("http://localhost:3000/users/1/calls", ({ request }) => {
        const page = Number(new URL(request.url).searchParams.get("page"));
        return HttpResponse.json({
          data: {
            items: [
              {
                id: page + 1,
                partner: { id: 1000 + page, name: `P${page}` },
                startedAt: "2026-04-29T12:00:00+09:00",
                durationSec: 120,
                analyzed: false,
              },
            ],
            hasNext: page === 0,
          },
          status: 200,
          message: "OK",
        });
      }),
    );

    const { result } = renderHook(() => useCallHistory(1), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(true);

    await result.current.fetchNextPage();

    await waitFor(() => expect(result.current.data?.pages.length).toBe(2));
    expect(result.current.hasNextPage).toBe(false);
  });
});
```

`http://localhost:3000` 은 `.env.test` 의 `VITE_API_BASE_URL` 값이다 (Task 0 컨텍스트에서 확인됨).

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
npm run test:run -- useCallHistory
```

Expected: FAIL (모듈 찾기 실패).

- [ ] **Step 3: 최소 구현 작성**

`src/domains/callHistory/hooks/useCallHistory.ts`:

```ts
import {
  useInfiniteQuery,
  type InfiniteData,
  type UseInfiniteQueryResult,
} from "@tanstack/react-query";
import { fetchCallHistory } from "../api/callHistoryApi";
import type { CallHistoryList } from "../types";

const PAGE_SIZE = 20;

export function useCallHistory(
  userId: number,
): UseInfiniteQueryResult<InfiniteData<CallHistoryList, number>, Error> {
  return useInfiniteQuery({
    queryKey: ["callHistory", userId, "list"],
    queryFn: ({ pageParam }) => fetchCallHistory(userId, pageParam, PAGE_SIZE),
    initialPageParam: 0,
    getNextPageParam: (lastPage, _allPages, lastPageParam) =>
      lastPage.hasNext ? lastPageParam + 1 : undefined,
  });
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npm run test:run -- useCallHistory
```

Expected: PASS (3 tests).

- [ ] **Step 5: 커밋**

```bash
git add src/domains/callHistory/hooks
git commit -m "feat: useCallHistory 무한 쿼리 훅 추가"
```

---

## Task 7: `classifyCalls` 시간 그룹핑 함수 (TDD)

순수 함수 — `now: Date` 인자로 결정적이라 fake timer 불필요. 페이지 전체 커버리지의 안전망.

**Files:**
- Create: `src/pages/callHistory/timeBucket.ts`
- Create: `src/pages/callHistory/timeBucket.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/pages/callHistory/timeBucket.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { CallHistoryItem } from "@/domains/callHistory/types";
import { classifyCalls } from "./timeBucket";

function makeCall(startedAt: string, id = 1): CallHistoryItem {
  return {
    id,
    partner: { id: 1000 + id, name: `P${id}` },
    startedAt,
    durationSec: 60,
    analyzed: false,
  };
}

describe("classifyCalls", () => {
  // 기준: 2026-04-29(수) 14:00 KST. 이번 주 시작은 2026-04-27(월) 0시.
  const now = new Date(2026, 3, 29, 14, 0, 0); // 4월(=index 3) 29일 14:00

  it("같은 달력 날짜의 통화는 today 그룹", () => {
    const today0001 = new Date(2026, 3, 29, 0, 1, 0).toISOString();
    const todayLate = new Date(2026, 3, 29, 23, 30, 0).toISOString();
    const groups = classifyCalls(
      [makeCall(todayLate, 1), makeCall(today0001, 2)],
      now,
    );
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ bucket: "today", label: "오늘" });
    expect(groups[0]?.items).toHaveLength(2);
  });

  it("어제는 thisWeek 그룹 (today 와 분리)", () => {
    const yesterday2359 = new Date(2026, 3, 28, 23, 59, 0).toISOString();
    const today0001 = new Date(2026, 3, 29, 0, 1, 0).toISOString();
    const groups = classifyCalls(
      [makeCall(today0001, 1), makeCall(yesterday2359, 2)],
      now,
    );
    expect(groups).toHaveLength(2);
    expect(groups[0]?.bucket).toBe("today");
    expect(groups[1]).toMatchObject({ bucket: "thisWeek", label: "이번 주" });
  });

  it("이번 주 월요일 0시는 thisWeek, 그 직전(일요일 23:59)은 thisMonth/byMonth", () => {
    const mondayStart = new Date(2026, 3, 27, 0, 0, 0).toISOString();
    const sundayEnd = new Date(2026, 3, 26, 23, 59, 0).toISOString();
    const groups = classifyCalls(
      [makeCall(mondayStart, 1), makeCall(sundayEnd, 2)],
      now,
    );
    expect(groups[0]?.bucket).toBe("thisWeek");
    // 4월 26일은 이번 달이지만 이번 주 이전 → thisMonth
    expect(groups[1]?.bucket).toBe("thisMonth");
  });

  it("이번 달 1일은 thisMonth, 지난 달 마지막 날은 byMonth", () => {
    const aprilFirst = new Date(2026, 3, 1, 12, 0, 0).toISOString();
    const marchLast = new Date(2026, 2, 31, 23, 0, 0).toISOString();
    const groups = classifyCalls(
      [makeCall(aprilFirst, 1), makeCall(marchLast, 2)],
      now,
    );
    expect(groups[0]?.bucket).toBe("thisMonth");
    expect(groups[1]).toMatchObject({ bucket: "byMonth", label: "3월" });
  });

  it("서로 다른 byMonth 월은 별개 그룹으로 분리되고 라벨은 'M월'", () => {
    const marchCall = new Date(2026, 2, 15, 12, 0, 0).toISOString();
    const februaryCall = new Date(2026, 1, 10, 12, 0, 0).toISOString();
    const groups = classifyCalls(
      [makeCall(marchCall, 1), makeCall(februaryCall, 2)],
      now,
    );
    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({ bucket: "byMonth", label: "3월" });
    expect(groups[1]).toMatchObject({ bucket: "byMonth", label: "2월" });
  });

  it("빈 그룹은 결과에 포함하지 않는다 (오늘 통화가 없으면 today 헤더 없음)", () => {
    const yesterday = new Date(2026, 3, 28, 12, 0, 0).toISOString();
    const groups = classifyCalls([makeCall(yesterday, 1)], now);
    expect(groups.map((g) => g.bucket)).not.toContain("today");
  });

  it("입력 순서를 그대로 유지한다 (정렬은 서버 책임)", () => {
    const earlier = new Date(2026, 3, 29, 9, 0, 0).toISOString();
    const later = new Date(2026, 3, 29, 18, 0, 0).toISOString();
    const groups = classifyCalls(
      [makeCall(later, 1), makeCall(earlier, 2)],
      now,
    );
    expect(groups[0]?.items.map((i) => i.id)).toEqual([1, 2]);
  });

  it("빈 배열이면 빈 결과", () => {
    expect(classifyCalls([], now)).toEqual([]);
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
npm run test:run -- timeBucket
```

Expected: FAIL (모듈 없음).

- [ ] **Step 3: 최소 구현 작성**

`src/pages/callHistory/timeBucket.ts`:

```ts
import type { CallHistoryItem } from "@/domains/callHistory/types";

export type Bucket = "today" | "thisWeek" | "thisMonth" | "byMonth";

export type CallGroup = {
  bucket: Bucket;
  label: string;
  items: CallHistoryItem[];
};

function isSameDate(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function startOfWeekMonday(d: Date): Date {
  const day = d.getDay(); // 0=일 ... 6=토
  const diffToMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  monday.setDate(monday.getDate() - diffToMonday);
  return monday;
}

function classify(startedAt: Date, now: Date): { bucket: Bucket; label: string } {
  if (isSameDate(startedAt, now)) {
    return { bucket: "today", label: "오늘" };
  }
  const weekStart = startOfWeekMonday(now);
  if (startedAt >= weekStart) {
    return { bucket: "thisWeek", label: "이번 주" };
  }
  if (
    startedAt.getFullYear() === now.getFullYear() &&
    startedAt.getMonth() === now.getMonth()
  ) {
    return { bucket: "thisMonth", label: "이번 달" };
  }
  return { bucket: "byMonth", label: `${startedAt.getMonth() + 1}월` };
}

export function classifyCalls(
  items: CallHistoryItem[],
  now: Date,
): CallGroup[] {
  const groups: CallGroup[] = [];
  for (const item of items) {
    const startedAt = new Date(item.startedAt);
    const { bucket, label } = classify(startedAt, now);
    const last = groups[groups.length - 1];
    if (last && last.bucket === bucket && last.label === label) {
      last.items.push(item);
    } else {
      groups.push({ bucket, label, items: [item] });
    }
  }
  return groups;
}
```

순서를 유지하면서 그룹화 — 인접한 같은 그룹을 합친다. 입력이 시간 내림차순이라는 전제 (서버 책임).

- [ ] **Step 4: 테스트 통과 확인**

```bash
npm run test:run -- timeBucket
```

Expected: PASS (8 tests).

- [ ] **Step 5: 커밋**

```bash
git add src/pages/callHistory/timeBucket.ts src/pages/callHistory/timeBucket.test.ts
git commit -m "feat: 통화 기록 시간 그룹핑 함수 (classifyCalls) 추가"
```

---

## Task 8: `formatCallMeta` 메타 포맷 함수 (TDD)

같은 `timeBucket.ts` 파일에 추가. 두 함수가 동일한 시간 분류 로직을 공유.

**Files:**
- Modify: `src/pages/callHistory/timeBucket.ts`
- Modify: `src/pages/callHistory/timeBucket.test.ts`

- [ ] **Step 1: 실패하는 테스트 추가 (`timeBucket.test.ts` 끝에)**

```ts
import { formatCallMeta } from "./timeBucket";

describe("formatCallMeta", () => {
  const now = new Date(2026, 3, 29, 14, 0, 0); // 2026-04-29(수) 14:00

  it("오늘 오후 시각 포맷", () => {
    const startedAt = new Date(2026, 3, 29, 19, 30, 0);
    expect(formatCallMeta(startedAt, 323, now)).toBe("오늘 오후 7:30 · 5:23");
  });

  it("오늘 오전 시각 포맷 (자정 직후는 오전 12:01)", () => {
    const startedAt = new Date(2026, 3, 29, 0, 1, 0);
    expect(formatCallMeta(startedAt, 60, now)).toBe("오늘 오전 12:01 · 1:00");
  });

  it("정오는 오후 12:00", () => {
    const startedAt = new Date(2026, 3, 29, 12, 0, 0);
    expect(formatCallMeta(startedAt, 605, now)).toBe("오늘 오후 12:00 · 10:05");
  });

  it("이번 주 (어제 = 1일 전)", () => {
    const startedAt = new Date(2026, 3, 28, 12, 0, 0);
    expect(formatCallMeta(startedAt, 432, now)).toBe("1일 전 · 7:12");
  });

  it("이번 주 (3일 전)", () => {
    const startedAt = new Date(2026, 3, 26, 12, 0, 0);
    expect(formatCallMeta(startedAt, 432, now)).toBe("3일 전 · 7:12");
  });

  it("그 이전은 'M월 D일'", () => {
    const startedAt = new Date(2026, 3, 12, 12, 0, 0);
    expect(formatCallMeta(startedAt, 500, now)).toBe("4월 12일 · 8:20");
  });

  it("초 자리 패딩 (9초 → 0:09)", () => {
    const startedAt = new Date(2026, 3, 29, 10, 0, 0);
    expect(formatCallMeta(startedAt, 9, now)).toBe("오늘 오전 10:00 · 0:09");
  });

  it("긴 길이 (605초 → 10:05)", () => {
    const startedAt = new Date(2026, 3, 29, 10, 0, 0);
    expect(formatCallMeta(startedAt, 605, now)).toBe("오늘 오전 10:00 · 10:05");
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
npm run test:run -- timeBucket
```

Expected: 새 테스트 8개 FAIL ("formatCallMeta is not a function" 등).

- [ ] **Step 3: 최소 구현 작성 — `timeBucket.ts` 끝에 추가**

```ts
function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function formatDuration(durationSec: number): string {
  const m = Math.floor(durationSec / 60);
  const s = durationSec % 60;
  return `${m}:${pad2(s)}`;
}

function formatTimeOfDay(d: Date): string {
  const h24 = d.getHours();
  const meridiem = h24 < 12 ? "오전" : "오후";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${meridiem} ${h12}:${pad2(d.getMinutes())}`;
}

function diffInDays(later: Date, earlier: Date): number {
  const a = new Date(later.getFullYear(), later.getMonth(), later.getDate());
  const b = new Date(earlier.getFullYear(), earlier.getMonth(), earlier.getDate());
  return Math.round((a.getTime() - b.getTime()) / 86_400_000);
}

export function formatCallMeta(
  startedAt: Date,
  durationSec: number,
  now: Date,
): string {
  const duration = formatDuration(durationSec);
  if (isSameDate(startedAt, now)) {
    return `오늘 ${formatTimeOfDay(startedAt)} · ${duration}`;
  }
  const weekStart = startOfWeekMonday(now);
  if (startedAt >= weekStart) {
    return `${diffInDays(now, startedAt)}일 전 · ${duration}`;
  }
  return `${startedAt.getMonth() + 1}월 ${startedAt.getDate()}일 · ${duration}`;
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npm run test:run -- timeBucket
```

Expected: PASS (16 tests, 기존 8 + 새 8).

- [ ] **Step 5: 커밋**

```bash
git add src/pages/callHistory/timeBucket.ts src/pages/callHistory/timeBucket.test.ts
git commit -m "feat: 통화 기록 메타 포맷 함수 (formatCallMeta) 추가"
```

---

## Task 9: `EmptyCallHistory` 컴포넌트 (TDD)

기존 `EmptyExpressions` 톤·구조를 참조 — 원형 배경 + SVG 아이콘 + 제목 + 부연.

**Files:**
- Create: `src/pages/callHistory/EmptyCallHistory.tsx`
- Create: `src/pages/callHistory/EmptyCallHistory.test.tsx`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/pages/callHistory/EmptyCallHistory.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyCallHistory } from "./EmptyCallHistory";

describe("EmptyCallHistory", () => {
  it("빈 상태 제목과 부연 텍스트를 노출한다", () => {
    render(<EmptyCallHistory />);
    expect(screen.getByText("아직 통화 기록이 없어요")).toBeInTheDocument();
    expect(screen.getByText("첫 통화를 시작해보세요.")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
npm run test:run -- EmptyCallHistory
```

Expected: FAIL (모듈 없음).

- [ ] **Step 3: 최소 구현 작성**

`src/pages/callHistory/EmptyCallHistory.tsx`:

```tsx
export function EmptyCallHistory() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-8 pb-32 text-center">
      <div
        aria-hidden="true"
        className="mb-6 flex h-[120px] w-[120px] items-center justify-center rounded-full bg-mint-50"
      >
        <svg
          width="64"
          height="64"
          viewBox="0 0 64 64"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
            transform="translate(15 16) scale(1.4)"
            fill="none"
            stroke="#10A47A"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <h2 className="m-0 mb-2 text-[17px] font-bold leading-[1.4] tracking-[-0.02em] text-gray-900">
        아직 통화 기록이 없어요
      </h2>
      <p className="m-0 max-w-[240px] text-[14.5px] font-medium leading-[1.55] tracking-[-0.01em] text-gray-500">
        첫 통화를 시작해보세요.
      </p>
    </div>
  );
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npm run test:run -- EmptyCallHistory
```

Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/pages/callHistory/EmptyCallHistory.tsx src/pages/callHistory/EmptyCallHistory.test.tsx
git commit -m "feat: 통화 기록 빈 상태 컴포넌트 추가"
```

---

## Task 10: `CallCard` 컴포넌트 (TDD)

목업의 `.call-card`. analyzed 분기로 "분석하기"/"분석 보기" 버튼 + 클릭 시 `/calls/:id/analysis` navigate.

**Files:**
- Create: `src/pages/callHistory/CallCard.tsx`
- Create: `src/pages/callHistory/CallCard.test.tsx`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/pages/callHistory/CallCard.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { CallHistoryItem } from "@/domains/callHistory/types";
import { CallCard } from "./CallCard";

function renderWithRouter(item: CallHistoryItem) {
  return render(
    <MemoryRouter initialEntries={["/history"]}>
      <Routes>
        <Route path="/history" element={<CallCard call={item} now={new Date(2026, 3, 29, 14, 0)} />} />
        <Route path="/calls/:callId/analysis" element={<div>analysis-page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

const baseCall: CallHistoryItem = {
  id: 42,
  partner: { id: 1042, name: "Jenson" },
  startedAt: new Date(2026, 3, 29, 19, 30, 0).toISOString(),
  durationSec: 323,
  analyzed: false,
};

describe("CallCard", () => {
  it("partner 이름 첫 글자(이니셜)와 이름·메타 텍스트를 노출한다", () => {
    renderWithRouter(baseCall);
    expect(screen.getByText("J")).toBeInTheDocument();
    expect(screen.getByText("Jenson")).toBeInTheDocument();
    expect(screen.getByText(/오늘 오후 7:30/)).toBeInTheDocument();
  });

  it("analyzed=false 일 때 '분석하기' 버튼이 보인다", () => {
    renderWithRouter({ ...baseCall, analyzed: false });
    expect(
      screen.getByRole("button", { name: /분석하기/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /분석 보기/ }),
    ).not.toBeInTheDocument();
  });

  it("analyzed=true 일 때 '분석 보기' 버튼이 보인다", () => {
    renderWithRouter({ ...baseCall, analyzed: true });
    expect(
      screen.getByRole("button", { name: /분석 보기/ }),
    ).toBeInTheDocument();
  });

  it("액션 버튼 클릭 시 /calls/:id/analysis 로 이동한다", async () => {
    renderWithRouter(baseCall);
    await userEvent.click(screen.getByRole("button", { name: /분석하기/ }));
    expect(screen.getByText("analysis-page")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
npm run test:run -- CallCard
```

Expected: FAIL.

- [ ] **Step 3: 최소 구현 작성**

`src/pages/callHistory/CallCard.tsx`:

```tsx
import { useNavigate } from "react-router-dom";
import type { CallHistoryItem } from "@/domains/callHistory/types";
import { formatCallMeta } from "./timeBucket";

type Props = {
  call: CallHistoryItem;
  now: Date;
};

export function CallCard({ call, now }: Props) {
  const navigate = useNavigate();
  const initial = call.partner.name[0] ?? "?";
  const meta = formatCallMeta(new Date(call.startedAt), call.durationSec, now);

  const handleBodyClick = () => {
    // TODO: 프로필 모달 이슈에서 연결
  };

  const handleActionClick = () => {
    navigate(`/calls/${call.id}/analysis`);
  };

  return (
    <div className="flex items-center gap-1 rounded-[18px] bg-white py-2 pl-3 pr-2 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
      <button
        type="button"
        onClick={handleBodyClick}
        className="flex flex-1 items-center gap-3 rounded-xl bg-transparent px-1 py-1.5 text-left active:bg-gray-50"
      >
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-mint-400 via-mint-500 to-coral-500">
          <span className="text-[20px] font-bold leading-none tracking-tight text-white">
            {initial}
          </span>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-[15.5px] font-bold leading-snug tracking-tight text-gray-900">
            {call.partner.name}
          </span>
          <span className="text-[12.5px] font-medium leading-none tracking-tight text-gray-500 tabular-nums">
            {meta}
          </span>
        </div>
      </button>
      <button
        type="button"
        onClick={handleActionClick}
        className={
          call.analyzed
            ? "flex flex-shrink-0 items-center gap-1 rounded-[10px] bg-transparent px-2 py-2 text-[13px] font-semibold leading-none tracking-tight text-gray-500 active:text-gray-800"
            : "flex flex-shrink-0 items-center gap-1 rounded-[10px] bg-mint-500 px-3 py-2 text-[13px] font-bold leading-none tracking-tight text-white active:bg-mint-600"
        }
      >
        {call.analyzed ? "분석 보기" : "분석하기"}
      </button>
    </div>
  );
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npm run test:run -- CallCard
```

Expected: PASS (4 tests).

- [ ] **Step 5: 커밋**

```bash
git add src/pages/callHistory/CallCard.tsx src/pages/callHistory/CallCard.test.tsx
git commit -m "feat: 통화 기록 카드 컴포넌트 추가"
```

---

## Task 11: `CallHistoryList` 컴포넌트 (TDD)

그룹별 헤더 + 카드 반복 + 무한 스크롤 sentinel. `IntersectionObserver`는 `test/setup.ts`에 mock이 이미 있어 그대로 동작 (단, 테스트에서 fetchNextPage 호출을 검증하려면 mock 인스턴스의 콜백을 트리거해야 함).

**Files:**
- Create: `src/pages/callHistory/CallHistoryList.tsx`
- Create: `src/pages/callHistory/CallHistoryList.test.tsx`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/pages/callHistory/CallHistoryList.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { CallHistoryItem } from "@/domains/callHistory/types";
import { CallHistoryList } from "./CallHistoryList";

const NOW = new Date(2026, 3, 29, 14, 0, 0);

function makeCall(
  id: number,
  startedAt: Date,
  overrides: Partial<CallHistoryItem> = {},
): CallHistoryItem {
  return {
    id,
    partner: { id: 1000 + id, name: `P${id}` },
    startedAt: startedAt.toISOString(),
    durationSec: 60 + id,
    analyzed: false,
    ...overrides,
  };
}

function renderWithRouter(ui: React.ReactNode) {
  return render(
    <MemoryRouter initialEntries={["/history"]}>
      <Routes>
        <Route path="/history" element={ui} />
        <Route path="/calls/:callId/analysis" element={<div>analysis</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("CallHistoryList", () => {
  it("그룹 헤더와 카드를 순서대로 렌더한다", () => {
    const items = [
      makeCall(1, new Date(2026, 3, 29, 19, 0)), // today
      makeCall(2, new Date(2026, 3, 28, 12, 0)), // thisWeek
      makeCall(3, new Date(2026, 3, 12, 12, 0)), // byMonth(4월) — thisMonth는 이번 주 이전 같은 달
    ];
    renderWithRouter(
      <CallHistoryList
        items={items}
        now={NOW}
        hasNextPage={false}
        isFetchingNextPage={false}
        onLoadMore={() => {}}
      />,
    );

    const headings = screen.getAllByRole("heading", { level: 2 });
    expect(headings.map((h) => h.textContent)).toEqual([
      "오늘",
      "이번 주",
      "이번 달",
    ]);
    expect(screen.getByText("P1")).toBeInTheDocument();
    expect(screen.getByText("P2")).toBeInTheDocument();
    expect(screen.getByText("P3")).toBeInTheDocument();
  });

  it("sentinel 이 뷰포트에 들어오면 onLoadMore 를 호출한다 (hasNextPage=true)", () => {
    const onLoadMore = vi.fn();
    let observerCb: IntersectionObserverCallback | undefined;
    class CapturingObserver {
      constructor(cb: IntersectionObserverCallback) {
        observerCb = cb;
      }
      observe() {}
      disconnect() {}
      unobserve() {}
      takeRecords() {
        return [];
      }
      root = null;
      rootMargin = "";
      thresholds = [];
    }
    vi.stubGlobal("IntersectionObserver", CapturingObserver);

    const items = [makeCall(1, new Date(2026, 3, 29, 12, 0))];
    renderWithRouter(
      <CallHistoryList
        items={items}
        now={NOW}
        hasNextPage={true}
        isFetchingNextPage={false}
        onLoadMore={onLoadMore}
      />,
    );

    // sentinel 이 보이는 척 콜백을 직접 호출
    observerCb?.(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );

    expect(onLoadMore).toHaveBeenCalledTimes(1);

    vi.unstubAllGlobals();
  });

  it("hasNextPage=false 면 sentinel observer 를 만들지 않거나 호출해도 onLoadMore 는 안 불린다", () => {
    const onLoadMore = vi.fn();
    let observerCb: IntersectionObserverCallback | undefined;
    class CapturingObserver {
      constructor(cb: IntersectionObserverCallback) {
        observerCb = cb;
      }
      observe() {}
      disconnect() {}
      unobserve() {}
      takeRecords() {
        return [];
      }
      root = null;
      rootMargin = "";
      thresholds = [];
    }
    vi.stubGlobal("IntersectionObserver", CapturingObserver);

    const items = [makeCall(1, new Date(2026, 3, 29, 12, 0))];
    renderWithRouter(
      <CallHistoryList
        items={items}
        now={NOW}
        hasNextPage={false}
        isFetchingNextPage={false}
        onLoadMore={onLoadMore}
      />,
    );

    observerCb?.(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );

    expect(onLoadMore).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
npm run test:run -- CallHistoryList
```

Expected: FAIL.

- [ ] **Step 3: 최소 구현 작성**

`src/pages/callHistory/CallHistoryList.tsx`:

```tsx
import { useEffect, useMemo, useRef } from "react";
import type { CallHistoryItem } from "@/domains/callHistory/types";
import { CallCard } from "./CallCard";
import { classifyCalls } from "./timeBucket";

type Props = {
  items: CallHistoryItem[];
  now: Date;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
};

export function CallHistoryList({
  items,
  now,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}: Props) {
  const groups = useMemo(() => classifyCalls(items, now), [items, now]);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasNextPage) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver((entries) => {
      const [entry] = entries;
      if (entry?.isIntersecting && !isFetchingNextPage) {
        onLoadMore();
      }
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, onLoadMore]);

  return (
    <div className="scrollbar-none flex-1 overflow-y-auto px-5 pb-24 pt-1">
      <h1 className="m-0 mb-5 mt-2.5 text-[22px] font-extrabold leading-[1.3] tracking-[-0.02em] text-gray-900">
        대화 기록
      </h1>
      {groups.map((group) => (
        <section key={`${group.bucket}-${group.label}`}>
          <h2 className="mb-2.5 ml-1 mt-5 text-[13px] font-bold leading-none tracking-tight text-gray-600 first-of-type:mt-1">
            {group.label}
          </h2>
          <div className="flex flex-col gap-2.5">
            {group.items.map((call) => (
              <CallCard key={call.id} call={call} now={now} />
            ))}
          </div>
        </section>
      ))}
      <div ref={sentinelRef} aria-hidden="true" className="h-1" />
    </div>
  );
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npm run test:run -- CallHistoryList
```

Expected: PASS (3 tests).

- [ ] **Step 5: 커밋**

```bash
git add src/pages/callHistory/CallHistoryList.tsx src/pages/callHistory/CallHistoryList.test.tsx
git commit -m "feat: 통화 기록 리스트 컴포넌트 + 무한 스크롤 추가"
```

---

## Task 12: `CallHistoryPage` 컴포넌트 (TDD)

데이터 훅 + 상태 분기 (loading/error/empty/list). 기존 `UserExpressionsPage` 의 status IIFE 패턴 차용 + 외곽 폰 프레임.

**Files:**
- Create: `src/pages/callHistory/CallHistoryPage.tsx`
- Create: `src/pages/callHistory/CallHistoryPage.test.tsx`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/pages/callHistory/CallHistoryPage.test.tsx`:

```tsx
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/mocks/server";
import { renderWithQueryClient } from "../../../test/utils/renderWithQueryClient";
import { CallHistoryPage } from "./CallHistoryPage";

describe("CallHistoryPage", () => {
  it("성공 시 그룹 헤더 + 카드를 렌더한다", async () => {
    renderWithQueryClient(<CallHistoryPage />);

    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 1, name: "대화 기록" })).toBeInTheDocument(),
    );
    // 적어도 한 그룹 헤더가 렌더돼야 한다 (시드가 매일 분포 갱신되므로 어떤 라벨이든)
    const groupHeadings = screen.getAllByRole("heading", { level: 2 });
    expect(groupHeadings.length).toBeGreaterThan(0);
  });

  it("빈 응답이면 EmptyCallHistory 노출", async () => {
    server.use(
      http.get("http://localhost:3000/users/:userId/calls", () =>
        HttpResponse.json({
          data: { items: [], hasNext: false },
          status: 200,
          message: "OK",
        }),
      ),
    );

    renderWithQueryClient(<CallHistoryPage />);

    expect(
      await screen.findByText("아직 통화 기록이 없어요"),
    ).toBeInTheDocument();
  });

  it("에러 시 다시 시도 버튼 클릭하면 refetch 동작", async () => {
    let attempts = 0;
    server.use(
      http.get("http://localhost:3000/users/:userId/calls", () => {
        attempts += 1;
        if (attempts === 1) {
          return new HttpResponse(null, { status: 500 });
        }
        return HttpResponse.json({
          data: {
            items: [
              {
                id: 1,
                partner: { id: 1001, name: "Retry" },
                startedAt: new Date().toISOString(),
                durationSec: 60,
                analyzed: false,
              },
            ],
            hasNext: false,
          },
          status: 200,
          message: "OK",
        });
      }),
    );

    renderWithQueryClient(<CallHistoryPage />);

    const retry = await screen.findByRole("button", { name: /다시 시도/ });
    await userEvent.click(retry);

    expect(await screen.findByText("Retry")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
npm run test:run -- CallHistoryPage
```

Expected: FAIL.

- [ ] **Step 3: 최소 구현 작성**

`src/pages/callHistory/CallHistoryPage.tsx`:

```tsx
import { env } from "@/config/env";
import { useCallHistory } from "@/domains/callHistory/hooks/useCallHistory";
import { BottomTabBar } from "@/components/BottomTabBar";
import { CallHistoryList } from "./CallHistoryList";
import { EmptyCallHistory } from "./EmptyCallHistory";

export function CallHistoryPage() {
  const query = useCallHistory(env.devUserId);
  const now = new Date();

  const status = (() => {
    if (query.isError) return "error";
    if (query.isPending) return "loading";
    return "success";
  })();

  const items = query.data?.pages.flatMap((p) => p.items) ?? [];
  const isEmpty = items.length === 0;

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#E7EAEE] p-6">
      <div className="phone relative h-[812px] w-[375px] overflow-hidden rounded-[44px] bg-white shadow-[0_0_0_10px_#1A1D22,0_30px_60px_rgba(0,0,0,0.25)] md:h-dvh md:w-full md:rounded-none md:shadow-none">
        <header className="relative z-10 flex h-11 items-center justify-between bg-white px-6 text-[15px] font-semibold text-gray-900">
          <span>9:41</span>
        </header>

        <main className="relative flex h-[calc(100%-44px)] flex-col bg-gray-50">
          {status === "loading" && (
            <div className="flex flex-1 items-center justify-center">
              <div
                role="status"
                aria-label="로딩 중"
                className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-mint-500"
              />
            </div>
          )}

          {status === "error" && (
            <div className="flex flex-1 flex-col items-center justify-center gap-4">
              <p className="text-[15px] font-medium text-gray-700">
                통화 기록을 불러오지 못했어요.
              </p>
              <button
                type="button"
                onClick={() => query.refetch()}
                className="rounded-md bg-mint-500 px-5 py-2.5 text-[14px] font-semibold text-white"
              >
                다시 시도
              </button>
            </div>
          )}

          {status === "success" && isEmpty && <EmptyCallHistory />}

          {status === "success" && !isEmpty && (
            <CallHistoryList
              items={items}
              now={now}
              hasNextPage={query.hasNextPage}
              isFetchingNextPage={query.isFetchingNextPage}
              onLoadMore={query.fetchNextPage}
            />
          )}

          <BottomTabBar />
        </main>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npm run test:run -- CallHistoryPage
```

Expected: PASS (3 tests).

- [ ] **Step 5: 커밋**

```bash
git add src/pages/callHistory/CallHistoryPage.tsx src/pages/callHistory/CallHistoryPage.test.tsx
git commit -m "feat: 통화 기록 페이지 컨테이너 추가"
```

---

## Task 13: `/history` 라우트 등록 + 탭바 연결

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/BottomTabBar.tsx`

- [ ] **Step 1: `src/App.tsx` 에 라우트 추가**

```tsx
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { QueryProvider } from "@/providers/QueryProvider";
import { MainPage } from "@/pages/main/MainPage";
import { MatchingPage } from "@/pages/matching/MatchingPage";
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
          <Route path="/mypage" element={<MyPagePage />} />
          <Route path="/expressions" element={<UserExpressionsPage />} />
          <Route path="/history" element={<CallHistoryPage />} />
        </Routes>
      </BrowserRouter>
    </QueryProvider>
  );
}
```

- [ ] **Step 2: `src/components/BottomTabBar.tsx` — 대화 기록 탭을 활성 링크로**

기존 disabled `<button>` (line 77-86)을 다음 `<Link>`로 교체한다.

```tsx
// import 영역에 isHistory 변수 추가
const isHistory = pathname === "/history";

// disabled button 자리에:
<Link
  to="/history"
  aria-current={isHistory ? "page" : undefined}
  className={`${TAB_BASE} ${isHistory ? "text-gray-900" : "text-gray-400"}`}
>
  <HistoryIcon />
  <span>대화 기록</span>
</Link>
```

전체 파일 변경 후 모습 (참고용 — 위 수정만 적용):

```tsx
import { Link, useLocation } from "react-router-dom";

// ... TAB_BASE, 아이콘 컴포넌트 그대로 ...

export function BottomTabBar() {
  const { pathname } = useLocation();
  const isHome = pathname === "/";
  const isMyPage = pathname === "/mypage";
  const isHistory = pathname === "/history";

  return (
    <nav
      aria-label="메인 네비게이션"
      className="absolute bottom-0 left-0 right-0 z-10 flex h-[72px] items-start border-t border-gray-100 bg-white pt-2 shadow-nav"
    >
      <Link
        to="/"
        aria-current={isHome ? "page" : undefined}
        className={`${TAB_BASE} ${isHome ? "text-gray-900" : "text-gray-400"}`}
      >
        <HomeIcon active={isHome} />
        <span>홈</span>
      </Link>

      <Link
        to="/history"
        aria-current={isHistory ? "page" : undefined}
        className={`${TAB_BASE} ${isHistory ? "text-gray-900" : "text-gray-400"}`}
      >
        <HistoryIcon />
        <span>대화 기록</span>
      </Link>

      <Link
        to="/mypage"
        aria-current={isMyPage ? "page" : undefined}
        className={`${TAB_BASE} ${isMyPage ? "text-gray-900" : "text-gray-400"}`}
      >
        <MyPageIcon active={isMyPage} />
        <span>마이페이지</span>
      </Link>
    </nav>
  );
}
```

- [ ] **Step 3: 기존 BottomTabBar 테스트 영향 확인**

```bash
npm run test:run -- BottomTabBar
```

기존 테스트가 disabled 상태를 검증한다면 해당 테스트도 갱신 필요. `src/components/BottomTabBar.test.tsx` 를 열어 "대화 기록" 관련 케이스를 다음으로 갱신한다 (필요 시):

```tsx
it("대화 기록 탭은 /history 로 이동하는 링크다", () => {
  // 기존: disabled button 검증 → 변경: Link href 검증
  render(<MemoryRouter><BottomTabBar /></MemoryRouter>);
  const link = screen.getByRole("link", { name: /대화 기록/ });
  expect(link).toHaveAttribute("href", "/history");
});
```

(원본 테스트가 disabled를 검증하지 않으면 이 단계는 스킵.)

- [ ] **Step 4: 전체 검증 — typecheck, lint, build, test, coverage**

```bash
npm run typecheck && npm run lint && npm run build && npm run test:run && npm run coverage
```

Expected: 모두 PASS, 커버리지 80% 이상.

- [ ] **Step 5: dev 서버에서 수동 확인 (UI 검증)**

```bash
# .env 에 VITE_MSW=on 으로 변경 (또는 한 번만 환경변수로)
VITE_MSW=on npm run dev
```

브라우저에서 `http://localhost:5173/history` 접속 → 콘솔에 `[MSW] Mocking enabled.` 로그 + 그룹 헤더("오늘"/"이번 주"/"이번 달"/"M월")와 카드 50건 페이지네이션 확인. 빈 상태는 시드 데이터가 있어 직접 테스트 불가 → 핸들러를 일시적으로 빈 응답으로 바꾸는 식의 수동 점검은 선택.

- [ ] **Step 6: 커밋**

```bash
git add src/App.tsx src/components/BottomTabBar.tsx src/components/BottomTabBar.test.tsx
git commit -m "$(cat <<'EOF'
feat: /history 라우트 등록 및 탭바 연결

CallHistoryPage 를 /history 에 마운트하고,
BottomTabBar 의 대화 기록 탭을 활성화한다.
EOF
)"
```

---

## 자체 리뷰 결과

### Spec 커버리지 매핑

| Spec 섹션 | 대응 Task |
| --- | --- |
| 1. 목표·범위 | 전체 |
| 2. 사용자 흐름 | Task 12, 13 |
| 3. 아키텍처 (디렉토리·원칙) | Task 1~13 모두 |
| 4. API 인터페이스 (types/api/hook) | Task 3, 5, 6 |
| 5. timeBucket | Task 7, 8 |
| 6. 페이지 컴포넌트 구조 | Task 9, 10, 11, 12 |
| 7. 라우팅 | Task 13 |
| 8. MSW dev 인프라 | Task 1, 2, 4 |
| 9. 빈/로딩/에러 처리 | Task 9 (빈), Task 12 (loading/error) |
| 10. 테스트 전략 | 모든 TDD task |
| 11. 비-스코프 | (의도적 제외) |
| 12. 마이그레이션 | Task 2 (`VITE_MSW` 토글) |

빈 항목 없음.

### Type/이름 일관성 점검

- `CallHistoryItem`, `CallHistoryList`, `Bucket`, `CallGroup` — 모든 task에서 동일하게 사용.
- `classifyCalls`, `formatCallMeta` — Task 7~12 전체 일관.
- 핸들러 path: `*/users/:userId/calls` (와일드카드) vs `${env.apiBaseUrl}/users/:userId/calls` (정확) — Task 4는 후자(다른 핸들러와 동일 스타일), 테스트의 `server.use` override는 `http://localhost:3000/...` 직접. 일관됨.
- 라우트: `/history` (FE 표시), `/users/:userId/calls` (BE API), `/calls/:callId/analysis` (분석 라우트 placeholder) — 세 가지 다른 의미, spec과 일치.

### Placeholder/모호성

스캔 결과 placeholder 없음. 모든 step이 실제 코드/명령/예상 결과를 포함.
