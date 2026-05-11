# 매칭 수락/거절 모달 구현 계획서 (App Review 대응)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apple App Review 거절 대응 — 매칭 성공 후 통화 자동 진입을 막고, 양쪽 사용자가 상대 정보를 본 뒤 「수락/거절」하는 모달을 끼워 넣는다. 양쪽 수락 시에만 통화 시작.

**Architecture:** 기존 `MatchingPage` 폴링 흐름을 확장한다. BE에 `AWAITING_CONFIRM` 상태가 추가되면 FE가 폴링 간격을 1초로 단축하고 모달을 띄운다. 모달에서 「수락」/「거절」을 POST하면 BE가 양쪽 응답을 동기화하고 `MATCHED` 또는 `WAITING`으로 전이시킨다. UI는 새 라우트 없이 `MatchingPage` 위 오버레이로 구현한다.

**Tech Stack:** React 18 · TypeScript · Vite · Tailwind · TanStack Query · MSW · Vitest · Testing Library

**관련 스펙:** Notion — [\[Spec\] 매칭 수락/거절 모달 (App Review 대응)](https://www.notion.so/35d33d3a895c8111b0b5cb163ca561ec)

---

## 사전 조건

- BE(`LingRing-BE`)는 별도 저장소. 이 plan은 FE 작업만 다룬다.
- FE는 MSW 모킹으로 BE 미구현 상태에서도 시나리오 검증 가능.
- 실제 BE 배포 전까지는 default MSW 핸들러를 시간차 시나리오(WAITING → AWAITING_CONFIRM → MATCHED)로 둬서 개발 모드에서 흐름을 손으로 확인할 수 있게 한다.
- **Task 1(HTML 목업)을 사용자가 시각 확인하기 전까지 Task 2 이후 진행 금지.**

---

## File Structure

### 신규 파일

| 경로 | 책임 |
| --- | --- |
| `lingring_match_confirm.html` | 모달 시각 디자인 목업 (기존 `lingring_*.html` 패턴) |
| `src/domains/matching/api/matchAccept.ts` | `POST /me/matching/accept`, `POST /me/matching/decline` 클라이언트 함수 |
| `src/domains/matching/api/matchAccept.test.ts` | API 클라이언트 테스트 |
| `src/domains/matching/hooks/useAcceptMatch.ts` | accept 뮤테이션 |
| `src/domains/matching/hooks/useAcceptMatch.test.tsx` | accept 훅 테스트 |
| `src/domains/matching/hooks/useDeclineMatch.ts` | decline 뮤테이션 |
| `src/domains/matching/hooks/useDeclineMatch.test.tsx` | decline 훅 테스트 |
| `src/domains/matching/hooks/useConfirmCountdown.ts` | `confirmDeadline` 기반 남은 시간 계산 훅 |
| `src/domains/matching/hooks/useConfirmCountdown.test.tsx` | 카운트다운 훅 테스트 |
| `src/pages/matching/MatchConfirmModal.tsx` | 수락/거절 모달 컴포넌트 |
| `src/pages/matching/MatchConfirmModal.test.tsx` | 모달 컴포넌트 테스트 |

### 수정 파일

| 경로 | 변경 |
| --- | --- |
| `src/domains/matching/types.ts` | `MatchStatus`에 `AWAITING_CONFIRM` 추가, `MatchingStatus.confirmDeadline` 추가 |
| `src/domains/matching/hooks/useMatchingStatus.ts` | `AWAITING_CONFIRM`일 때 폴링 1초로 단축 |
| `src/domains/matching/hooks/useMatchingStatus.test.tsx` | 새 상태 동작 테스트 |
| `src/pages/matching/MatchingPage.tsx` | `AWAITING_CONFIRM` 분기 → `MatchConfirmModal` 표시 |
| `src/pages/matching/MatchingPage.test.tsx` | confirm 분기/모달 흐름 테스트 |
| `src/mocks/handlers.ts` | accept/decline 기본 핸들러 + 개발용 시나리오 시뮬레이션 |

---

## Task 1: HTML 목업 작성 + 사용자 시각 검토

**Files:**
- Create: `lingring_match_confirm.html`

**목적:** React로 옮기기 전 시각 디자인을 사용자가 브라우저에서 확인하고 승인받는다. 기존 `lingring_*.html` 패턴 — phone frame + iOS-like status bar + Pretendard 폰트 + mint/coral 토큰.

- [ ] **Step 1: `lingring_matching.html`의 디자인 토큰·phone frame·status bar 섹션을 그대로 가져온 베이스 만들기**

베이스가 같아야 일관성 있는 비교가 가능하다. 다음을 그대로 복사한다:
- `:root` 디자인 토큰 (mint/coral/gray + radius + shadow + font)
- `* { box-sizing }`, `html, body` 기본 스타일
- `.viewport`, `.phone`, `.status-bar` (포함 SVG 아이콘)
- `.screen` (radial gradient + .blob.a/.blob.b 배경)

- [ ] **Step 2: 모달 마크업과 스타일을 추가**

`MatchingPage`가 뒤에 dim 상태로 깔린 위에 모달 카드가 떠 있는 형태. 모달 내용:

```html
<div class="screen">
  <!-- 기존 매칭 화면 요소(블롭, 오브, 안내 문구)는 그대로 깔린 상태로 표시 -->
  <div class="blob a"></div>
  <div class="blob b"></div>
  <!-- ... -->

  <!-- 수락 모달 -->
  <div class="confirm-backdrop show"></div>
  <div class="confirm-modal show" role="dialog" aria-modal="true" aria-labelledby="confirmTitle">
    <h2 id="confirmTitle" class="visually-hidden">매칭된 상대 확인</h2>

    <!-- 카운트다운 -->
    <div class="countdown">
      <span class="countdown-bar" style="--progress: 100%"></span>
      <span class="countdown-text">15s</span>
    </div>

    <!-- 프로필 -->
    <div class="profile">
      <div class="avatar">
        <img src="profile.jpg" alt="상대 프로필 이미지" />
      </div>
      <p class="nickname">Sophie</p>
      <span class="level-chip">Intermediate</span>
    </div>

    <!-- 매너온도 -->
    <div class="temp">
      <div class="temp-head">
        <span class="temp-label">매너온도</span>
        <span class="temp-value">36.5°C</span>
      </div>
      <div class="temp-track">
        <div class="temp-fill" style="width: 37%"></div>
      </div>
    </div>

    <!-- 액션 -->
    <div class="actions">
      <button type="button" class="btn-secondary">거절</button>
      <button type="button" class="btn-primary">수락</button>
    </div>
  </div>
</div>
```

스타일은 기존 `PartnerProfileModal`의 비주얼 컨벤션과 일치시킨다:
- `.confirm-backdrop`: `position: absolute; inset: 0; background: rgba(0,0,0,0.45);`
- `.confirm-modal`: 흰색 카드, `border-radius: 22px`, `padding: 24px 24px 20px`, max-width 320px, 중앙 정렬
- `.btn-primary`: `bg: var(--mint-500); color: white; border-radius: 14px; padding: 14px 0; font-weight: 700;`
- `.btn-secondary`: `bg: var(--gray-100); color: var(--gray-800);`
- 카운트다운 바: 가로 막대, mint-500 → coral-500 그라데이션, 5초 이하부터 coral 강조

- [ ] **Step 3: 카운트다운 작동 시뮬레이션용 간단한 스크립트 추가**

```html
<script>
  const TOTAL_MS = 15000;
  const start = Date.now();
  const bar = document.querySelector('.countdown-bar');
  const text = document.querySelector('.countdown-text');

  function tick() {
    const elapsed = Date.now() - start;
    const remaining = Math.max(0, TOTAL_MS - elapsed);
    const seconds = Math.ceil(remaining / 1000);
    bar.style.setProperty('--progress', `${(remaining / TOTAL_MS) * 100}%`);
    text.textContent = `${seconds}s`;
    if (remaining > 0) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  document.querySelector('.btn-primary').addEventListener('click', () => {
    alert('수락 — 통화 화면으로 이동');
  });
  document.querySelector('.btn-secondary').addEventListener('click', () => {
    alert('거절 — 매칭 페이지로 복귀 (10분 cooldown)');
  });
</script>
```

- [ ] **Step 4: 로컬에서 열어 확인**

```bash
open lingring_match_confirm.html
```

브라우저에서 직접 열어 카운트다운 동작, 모달 비주얼 확인.

- [ ] **Step 5: 사용자에게 시각 검토 요청**

사용자가 직접 브라우저에서 열고 다음을 확인:
1. 모달이 매칭 페이지 위에 자연스럽게 떠 있는가?
2. 프로필 정보(닉네임/레벨/매너온도)가 충분히 식별 가능한가? — Apple 가이드라인 핵심
3. 「수락」/「거절」 라벨·위치가 직관적인가?
4. 15초 카운트다운 시각화가 압박을 너무 주거나 너무 약하지 않은가?

**🚫 GATE: 사용자가 시각 디자인을 명시적으로 승인할 때까지 Task 2로 진행하지 않는다.** 수정 요청이 있으면 같은 Task 1 안에서 반복.

- [ ] **Step 6: 사용자 승인 후 커밋**

```bash
git add lingring_match_confirm.html
git commit -m "design: 매칭 수락/거절 모달 시각 목업 추가"
```

---

## Task 2: 매칭 도메인 타입 확장

**Files:**
- Modify: `src/domains/matching/types.ts`

- [ ] **Step 1: 타입 확장 작성**

```ts
export type MatchStatus = "MATCHED" | "WAITING" | "NONE" | "AWAITING_CONFIRM";

export type MatchingStatus = {
  status: MatchStatus;
  partnerId: number | null;
  roomId: string | null;
  confirmDeadline: string | null;
};
```

- [ ] **Step 2: 타입 체크 통과 확인**

```bash
npx tsc -p tsconfig.app.json --noEmit
```

기존 코드에서 `confirmDeadline` 미사용 처리 때문에 `useMatchingStatus`나 핸들러 응답이 깨질 수 있다. 깨지면 Task 4(MSW 핸들러)와 함께 묶어서 통과시키므로, 일단 이 단계에서는 타입 추가만 하고 다음 task에서 호환을 맞춘다. `npm run test`까지 깨지면 OK — Task 4에서 함께 통과시킨다.

- [ ] **Step 3: 커밋**

```bash
git add src/domains/matching/types.ts
git commit -m "feat(matching): AWAITING_CONFIRM 상태와 confirmDeadline 필드 추가"
```

---

## Task 3: accept/decline API 클라이언트

**Files:**
- Create: `src/domains/matching/api/matchAccept.ts`
- Create: `src/domains/matching/api/matchAccept.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// src/domains/matching/api/matchAccept.test.ts
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/mocks/server";
import { acceptMatch, declineMatch } from "./matchAccept";

describe("acceptMatch", () => {
  it("204 응답이면 정상 종료한다", async () => {
    await expect(acceptMatch()).resolves.toBeNull();
  });

  it("4xx 응답이면 ApiError 를 throw 한다", async () => {
    server.use(
      http.post("http://localhost:3000/api/v1/me/matching/accept", () =>
        HttpResponse.json(
          { data: null, status: 409, message: "ALREADY_RESPONDED" },
          { status: 409 },
        ),
      ),
    );

    await expect(acceptMatch()).rejects.toThrow("ALREADY_RESPONDED");
  });
});

describe("declineMatch", () => {
  it("204 응답이면 정상 종료한다", async () => {
    await expect(declineMatch()).resolves.toBeNull();
  });
});
```

- [ ] **Step 2: 테스트 실행 (실패 확인)**

```bash
npx vitest run src/domains/matching/api/matchAccept.test.ts
```

Expected: FAIL with "Cannot find module './matchAccept'"

- [ ] **Step 3: 클라이언트 구현**

```ts
// src/domains/matching/api/matchAccept.ts
import { httpPost } from "@/lib/http";

const ACCEPT_PATH = "/me/matching/accept";
const DECLINE_PATH = "/me/matching/decline";

export const acceptMatch = (): Promise<void> => httpPost(ACCEPT_PATH);

export const declineMatch = (): Promise<void> => httpPost(DECLINE_PATH);
```

- [ ] **Step 4: MSW 기본 핸들러 추가 (테스트가 통과하도록)**

`src/mocks/handlers.ts`에 다음 두 핸들러 추가 (기존 `/me/matching` 핸들러 바로 아래):

```ts
http.post(apiUrl("/me/matching/accept"), () => {
  return HttpResponse.json({
    data: null,
    status: 204,
    message: "NO_CONTENT",
  });
}),

http.post(apiUrl("/me/matching/decline"), () => {
  return HttpResponse.json({
    data: null,
    status: 204,
    message: "NO_CONTENT",
  });
}),
```

- [ ] **Step 5: 테스트 통과 확인**

```bash
npx vitest run src/domains/matching/api/matchAccept.test.ts
```

Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add src/domains/matching/api/matchAccept.ts src/domains/matching/api/matchAccept.test.ts src/mocks/handlers.ts
git commit -m "feat(matching): accept/decline API 클라이언트 + MSW 기본 핸들러"
```

---

## Task 4: 매칭 상태 응답에 confirmDeadline 반영

**Files:**
- Modify: `src/mocks/handlers.ts`
- Modify: `src/domains/matching/api/matchingApi.test.ts`

기본 핸들러는 WAITING이라 `confirmDeadline: null`을 명시적으로 반환해야 새 타입과 일치한다.

- [ ] **Step 1: 기본 GET 핸들러에 `confirmDeadline: null` 추가**

`src/mocks/handlers.ts`의 `http.get(apiUrl("/me/matching"), ...)` 응답 데이터를 다음으로 교체:

```ts
http.get(apiUrl("/me/matching"), () => {
  return HttpResponse.json({
    data: { status: "WAITING", partnerId: null, roomId: null, confirmDeadline: null },
    status: 200,
    message: "OK",
  });
}),
```

- [ ] **Step 2: `matchingApi.test.ts`의 기존 응답 객체에도 필드 반영**

`fetchMatchingStatus`의 기본 응답 테스트는 다음으로 수정:

```ts
it("기본 응답이면 WAITING 상태를 반환한다", async () => {
  const result = await fetchMatchingStatus();
  expect(result).toEqual({
    status: "WAITING",
    partnerId: null,
    roomId: null,
    confirmDeadline: null,
  });
});
```

MATCHED 테스트의 응답도 `confirmDeadline: null` 추가:

```ts
it("MATCHED 응답이면 partnerId 가 채워져 반환된다", async () => {
  server.use(
    http.get("http://localhost:3000/api/v1/me/matching", () =>
      HttpResponse.json({
        data: {
          status: "MATCHED",
          partnerId: 42,
          roomId: "11111111-1111-1111-1111-111111111111",
          confirmDeadline: null,
        },
        status: 200,
        message: "OK",
      }),
    ),
  );

  const result = await fetchMatchingStatus();
  expect(result).toEqual({
    status: "MATCHED",
    partnerId: 42,
    roomId: "11111111-1111-1111-1111-111111111111",
    confirmDeadline: null,
  });
});
```

`NONE` 테스트도 동일하게 응답에 `confirmDeadline: null` 추가.

- [ ] **Step 3: 전체 테스트 실행**

```bash
npm test
```

이 시점에서 모든 기존 테스트가 통과해야 한다 (타입 확장으로 인한 호환성 정리 완료).

- [ ] **Step 4: 커밋**

```bash
git add src/mocks/handlers.ts src/domains/matching/api/matchingApi.test.ts
git commit -m "test(matching): confirmDeadline 필드 응답 정합성 보정"
```

---

## Task 5: useAcceptMatch / useDeclineMatch 훅

**Files:**
- Create: `src/domains/matching/hooks/useAcceptMatch.ts`
- Create: `src/domains/matching/hooks/useAcceptMatch.test.tsx`
- Create: `src/domains/matching/hooks/useDeclineMatch.ts`
- Create: `src/domains/matching/hooks/useDeclineMatch.test.tsx`

기존 `useEnterMatchingQueue` 패턴을 그대로 따른다.

- [ ] **Step 1: useAcceptMatch 테스트 작성**

```tsx
// src/domains/matching/hooks/useAcceptMatch.test.tsx
import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { server } from "@/mocks/server";
import { createTestQueryClient } from "../../../../test/utils/renderWithQueryClient";
import { useAcceptMatch } from "./useAcceptMatch";

const wrapper = ({ children }: { children: ReactNode }) => {
  const queryClient = createTestQueryClient();
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

describe("useAcceptMatch", () => {
  it("mutate 호출 시 accept 엔드포인트가 호출된다", async () => {
    let postCount = 0;
    server.use(
      http.post("http://localhost:3000/api/v1/me/matching/accept", () => {
        postCount++;
        return HttpResponse.json({ data: null, status: 204, message: "NO_CONTENT" });
      }),
    );

    const { result } = renderHook(() => useAcceptMatch(), { wrapper });

    result.current.mutate();

    await waitFor(() => expect(postCount).toBe(1));
  });
});
```

- [ ] **Step 2: useAcceptMatch 구현**

```ts
// src/domains/matching/hooks/useAcceptMatch.ts
import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { acceptMatch } from "../api/matchAccept";

export function useAcceptMatch(): UseMutationResult<void, Error, void> {
  return useMutation({
    mutationFn: acceptMatch,
  });
}
```

- [ ] **Step 3: useAcceptMatch 테스트 통과 확인**

```bash
npx vitest run src/domains/matching/hooks/useAcceptMatch.test.tsx
```

Expected: PASS

- [ ] **Step 4: useDeclineMatch도 동일 패턴으로 작성**

```tsx
// src/domains/matching/hooks/useDeclineMatch.test.tsx
import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { server } from "@/mocks/server";
import { createTestQueryClient } from "../../../../test/utils/renderWithQueryClient";
import { useDeclineMatch } from "./useDeclineMatch";

const wrapper = ({ children }: { children: ReactNode }) => {
  const queryClient = createTestQueryClient();
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

describe("useDeclineMatch", () => {
  it("mutate 호출 시 decline 엔드포인트가 호출된다", async () => {
    let postCount = 0;
    server.use(
      http.post("http://localhost:3000/api/v1/me/matching/decline", () => {
        postCount++;
        return HttpResponse.json({ data: null, status: 204, message: "NO_CONTENT" });
      }),
    );

    const { result } = renderHook(() => useDeclineMatch(), { wrapper });

    result.current.mutate();

    await waitFor(() => expect(postCount).toBe(1));
  });
});
```

```ts
// src/domains/matching/hooks/useDeclineMatch.ts
import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { declineMatch } from "../api/matchAccept";

export function useDeclineMatch(): UseMutationResult<void, Error, void> {
  return useMutation({
    mutationFn: declineMatch,
  });
}
```

- [ ] **Step 5: 전체 테스트 통과 확인**

```bash
npx vitest run src/domains/matching/hooks/
```

Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add src/domains/matching/hooks/useAcceptMatch.ts src/domains/matching/hooks/useAcceptMatch.test.tsx src/domains/matching/hooks/useDeclineMatch.ts src/domains/matching/hooks/useDeclineMatch.test.tsx
git commit -m "feat(matching): accept/decline mutation 훅 추가"
```

---

## Task 6: useMatchingStatus 폴링 간격 동적화

**Files:**
- Modify: `src/domains/matching/hooks/useMatchingStatus.ts`
- Modify: `src/domains/matching/hooks/useMatchingStatus.test.tsx`

- [ ] **Step 1: 새 동작에 대한 실패 테스트 추가**

`useMatchingStatus.test.tsx`의 `describe("useMatchingStatus", ...)` 안에 추가:

```tsx
it("AWAITING_CONFIRM 응답이면 1초 후 다시 폴링한다", async () => {
  let callCount = 0;
  server.use(
    http.get("http://localhost:3000/api/v1/me/matching", () => {
      callCount++;
      return HttpResponse.json({
        data: {
          status: "AWAITING_CONFIRM",
          partnerId: 2,
          roomId: null,
          confirmDeadline: new Date(Date.now() + 15000).toISOString(),
        },
        status: 200,
        message: "OK",
      });
    }),
  );

  vi.useFakeTimers({ shouldAdvanceTime: true });

  const { result } = renderHook(() => useMatchingStatus(true), { wrapper });

  await waitFor(() => expect(result.current.data?.status).toBe("AWAITING_CONFIRM"));
  const firstCallCount = callCount;

  // 3초 후에도 아직 1초 폴링이라 여러 번 호출됐어야 한다
  await vi.advanceTimersByTimeAsync(3500);
  await waitFor(() => expect(callCount).toBeGreaterThanOrEqual(firstCallCount + 3));
});
```

- [ ] **Step 2: 테스트 실행 (실패 확인)**

```bash
npx vitest run src/domains/matching/hooks/useMatchingStatus.test.tsx
```

Expected: 새 케이스 FAIL (1초 폴링 미구현)

- [ ] **Step 3: 폴링 간격 동적화 구현**

`src/domains/matching/hooks/useMatchingStatus.ts` 전체 교체:

```ts
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { fetchMatchingStatus } from "../api/matchingApi";
import type { MatchingStatus } from "../types";

const WAITING_INTERVAL_MS = 3000;
const AWAITING_CONFIRM_INTERVAL_MS = 1000;

export function useMatchingStatus(
  enabled: boolean,
): UseQueryResult<MatchingStatus, Error> {
  return useQuery({
    queryKey: ["matching", "status"],
    queryFn: fetchMatchingStatus,
    enabled,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === "MATCHED") return false;
      if (status === "AWAITING_CONFIRM") return AWAITING_CONFIRM_INTERVAL_MS;
      return WAITING_INTERVAL_MS;
    },
    refetchOnMount: "always",
    gcTime: 0,
    staleTime: 0,
  });
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npx vitest run src/domains/matching/hooks/useMatchingStatus.test.tsx
```

Expected: PASS (모든 케이스)

- [ ] **Step 5: 커밋**

```bash
git add src/domains/matching/hooks/useMatchingStatus.ts src/domains/matching/hooks/useMatchingStatus.test.tsx
git commit -m "feat(matching): AWAITING_CONFIRM에서 1초 폴링으로 단축"
```

---

## Task 7: useConfirmCountdown 훅

**Files:**
- Create: `src/domains/matching/hooks/useConfirmCountdown.ts`
- Create: `src/domains/matching/hooks/useConfirmCountdown.test.tsx`

`confirmDeadline` (ISO timestamp) 기준으로 남은 ms를 매 250ms 갱신해 반환한다. FE 자체 타이머가 아니라 BE deadline을 권위로 삼는다.

- [ ] **Step 1: 실패 테스트 작성**

```tsx
// src/domains/matching/hooks/useConfirmCountdown.test.tsx
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useConfirmCountdown } from "./useConfirmCountdown";

describe("useConfirmCountdown", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("deadline 이 null 이면 remainingMs 는 null", () => {
    const { result } = renderHook(() => useConfirmCountdown(null));
    expect(result.current.remainingMs).toBeNull();
    expect(result.current.expired).toBe(false);
  });

  it("미래 deadline 이면 양수 remainingMs 를 반환한다", () => {
    const deadline = new Date(Date.now() + 10_000).toISOString();
    const { result } = renderHook(() => useConfirmCountdown(deadline));
    expect(result.current.remainingMs).toBeGreaterThan(0);
    expect(result.current.expired).toBe(false);
  });

  it("과거 deadline 이면 expired=true, remainingMs=0", () => {
    const deadline = new Date(Date.now() - 1000).toISOString();
    const { result } = renderHook(() => useConfirmCountdown(deadline));
    expect(result.current.remainingMs).toBe(0);
    expect(result.current.expired).toBe(true);
  });

  it("시간이 흐르면 remainingMs 가 감소한다", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const deadline = new Date(Date.now() + 5000).toISOString();
    const { result } = renderHook(() => useConfirmCountdown(deadline));

    const initial = result.current.remainingMs ?? 0;
    await vi.advanceTimersByTimeAsync(1000);
    await waitFor(() => {
      expect(result.current.remainingMs).toBeLessThan(initial);
    });
  });
});
```

- [ ] **Step 2: 테스트 실행 (실패 확인)**

```bash
npx vitest run src/domains/matching/hooks/useConfirmCountdown.test.tsx
```

Expected: FAIL "Cannot find module './useConfirmCountdown'"

- [ ] **Step 3: 훅 구현**

```ts
// src/domains/matching/hooks/useConfirmCountdown.ts
import { useEffect, useState } from "react";

const TICK_INTERVAL_MS = 250;

type Result = {
  remainingMs: number | null;
  expired: boolean;
};

function computeRemaining(deadlineIso: string): number {
  const deadlineMs = new Date(deadlineIso).getTime();
  return Math.max(0, deadlineMs - Date.now());
}

export function useConfirmCountdown(deadlineIso: string | null): Result {
  const [remainingMs, setRemainingMs] = useState<number | null>(() =>
    deadlineIso === null ? null : computeRemaining(deadlineIso),
  );

  useEffect(() => {
    if (deadlineIso === null) {
      setRemainingMs(null);
      return;
    }
    setRemainingMs(computeRemaining(deadlineIso));
    const id = setInterval(() => {
      setRemainingMs(computeRemaining(deadlineIso));
    }, TICK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [deadlineIso]);

  return {
    remainingMs,
    expired: remainingMs !== null && remainingMs === 0,
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npx vitest run src/domains/matching/hooks/useConfirmCountdown.test.tsx
```

Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/domains/matching/hooks/useConfirmCountdown.ts src/domains/matching/hooks/useConfirmCountdown.test.tsx
git commit -m "feat(matching): confirmDeadline 기반 카운트다운 훅 추가"
```

---

## Task 8: MatchConfirmModal 컴포넌트

**Files:**
- Create: `src/pages/matching/MatchConfirmModal.tsx`
- Create: `src/pages/matching/MatchConfirmModal.test.tsx`

Task 1의 HTML 목업을 React로 옮기되, Tailwind 토큰과 기존 컴포넌트(`Avatar`, `useUserProfile`)를 재사용한다.

- [ ] **Step 1: 컴포넌트 테스트 작성 (TDD — 핵심 동작부터)**

```tsx
// src/pages/matching/MatchConfirmModal.test.tsx
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { server } from "@/mocks/server";
import { renderWithQueryClient } from "../../../test/utils/renderWithQueryClient";
import { MatchConfirmModal } from "./MatchConfirmModal";

const futureDeadline = () => new Date(Date.now() + 15000).toISOString();

describe("MatchConfirmModal", () => {
  it("partnerId 의 프로필 정보를 표시한다", async () => {
    server.use(
      http.get("http://localhost:3000/api/v1/users/2", () =>
        HttpResponse.json({
          data: {
            id: 2,
            nickname: "Sophie",
            profileImage: null,
            level: "INTERMEDIATE",
            mannerTemperature: 36.5,
          },
          status: 200,
          message: "OK",
        }),
      ),
    );

    renderWithQueryClient(
      <MatchConfirmModal
        partnerId={2}
        confirmDeadline={futureDeadline()}
        onAccept={vi.fn()}
        onDecline={vi.fn()}
      />,
    );

    expect(await screen.findByText("Sophie")).toBeInTheDocument();
    expect(screen.getByText("Intermediate")).toBeInTheDocument();
    expect(screen.getByText("36.5°C")).toBeInTheDocument();
  });

  it("수락 버튼을 누르면 onAccept 가 호출된다", async () => {
    const onAccept = vi.fn();
    const user = userEvent.setup();

    renderWithQueryClient(
      <MatchConfirmModal
        partnerId={2}
        confirmDeadline={futureDeadline()}
        onAccept={onAccept}
        onDecline={vi.fn()}
      />,
    );

    await screen.findByText("Sophie");
    await user.click(screen.getByRole("button", { name: "수락" }));

    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  it("거절 버튼을 누르면 onDecline 이 호출된다", async () => {
    const onDecline = vi.fn();
    const user = userEvent.setup();

    renderWithQueryClient(
      <MatchConfirmModal
        partnerId={2}
        confirmDeadline={futureDeadline()}
        onAccept={vi.fn()}
        onDecline={onDecline}
      />,
    );

    await screen.findByText("Sophie");
    await user.click(screen.getByRole("button", { name: "거절" }));

    expect(onDecline).toHaveBeenCalledTimes(1);
  });

  it("isResponding=true 면 두 버튼 모두 disabled", async () => {
    renderWithQueryClient(
      <MatchConfirmModal
        partnerId={2}
        confirmDeadline={futureDeadline()}
        onAccept={vi.fn()}
        onDecline={vi.fn()}
        isResponding
      />,
    );

    await screen.findByText("Sophie");
    expect(screen.getByRole("button", { name: "수락" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "거절" })).toBeDisabled();
  });

  it("deadline 이 만료되면 onTimeout 을 1회 호출한다", async () => {
    const onTimeout = vi.fn();
    const pastDeadline = new Date(Date.now() - 1000).toISOString();

    renderWithQueryClient(
      <MatchConfirmModal
        partnerId={2}
        confirmDeadline={pastDeadline}
        onAccept={vi.fn()}
        onDecline={vi.fn()}
        onTimeout={onTimeout}
      />,
    );

    await waitFor(() => expect(onTimeout).toHaveBeenCalledTimes(1));
  });
});
```

- [ ] **Step 2: 테스트 실행 (실패 확인)**

```bash
npx vitest run src/pages/matching/MatchConfirmModal.test.tsx
```

Expected: FAIL "Cannot find module './MatchConfirmModal'"

- [ ] **Step 3: 컴포넌트 구현**

```tsx
// src/pages/matching/MatchConfirmModal.tsx
import { useEffect, useRef } from "react";
import { Avatar } from "@/components/Avatar";
import { useConfirmCountdown } from "@/domains/matching/hooks/useConfirmCountdown";
import { useUserProfile } from "@/domains/user/hooks/useUserProfile";
import type { Level } from "@/domains/user/types";

const LEVEL_LABEL: Record<Level, string> = {
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
};

const MAX_TEMPERATURE = 99;
const TOTAL_MS = 15_000;
const URGENT_THRESHOLD_MS = 5_000;

type Props = {
  partnerId: number;
  confirmDeadline: string;
  onAccept: () => void;
  onDecline: () => void;
  onTimeout?: () => void;
  isResponding?: boolean;
};

export function MatchConfirmModal({
  partnerId,
  confirmDeadline,
  onAccept,
  onDecline,
  onTimeout,
  isResponding = false,
}: Props) {
  const profile = useUserProfile(partnerId);
  const { remainingMs, expired } = useConfirmCountdown(confirmDeadline);
  const timeoutFiredRef = useRef(false);

  useEffect(() => {
    if (!expired || timeoutFiredRef.current) return;
    timeoutFiredRef.current = true;
    onTimeout?.();
  }, [expired, onTimeout]);

  const remainingSeconds =
    remainingMs === null ? 0 : Math.ceil(remainingMs / 1000);
  const progressPercent =
    remainingMs === null ? 0 : (remainingMs / TOTAL_MS) * 100;
  const isUrgent = remainingMs !== null && remainingMs <= URGENT_THRESHOLD_MS;

  return (
    <>
      <div
        aria-hidden="true"
        className="absolute inset-0 z-10 bg-black/45"
      />
      <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center px-6">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="match-confirm-title"
          className="pointer-events-auto relative w-full max-w-[320px] rounded-[22px] bg-white p-6 pb-5 shadow-[0_20px_50px_rgba(0,0,0,0.25)]"
        >
          <h2 id="match-confirm-title" className="sr-only">
            매칭된 상대 확인
          </h2>

          <div className="mb-4 flex items-center gap-2">
            <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
              <div
                data-testid="confirm-countdown-bar"
                className={`h-full rounded-full transition-[width] duration-200 ${
                  isUrgent ? "bg-coral-500" : "bg-mint-500"
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span
              className={`min-w-[28px] text-right text-[13px] font-bold tabular-nums ${
                isUrgent ? "text-coral-600" : "text-gray-700"
              }`}
            >
              {remainingSeconds}s
            </span>
          </div>

          {profile.isPending && <ConfirmSkeleton />}
          {profile.isError && (
            <p className="py-6 text-center text-[14px] font-medium text-gray-700">
              상대 프로필을 불러오지 못했어요.
            </p>
          )}
          {profile.data && (
            <ConfirmBody
              nickname={profile.data.nickname}
              profileImage={profile.data.profileImage}
              level={profile.data.level}
              mannerTemperature={profile.data.mannerTemperature}
            />
          )}

          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={onDecline}
              disabled={isResponding}
              className="flex-1 rounded-[14px] bg-gray-100 py-3.5 text-[15px] font-bold text-gray-800 transition active:scale-[0.98] disabled:opacity-50"
            >
              거절
            </button>
            <button
              type="button"
              onClick={onAccept}
              disabled={isResponding || !profile.data}
              className="flex-1 rounded-[14px] bg-mint-500 py-3.5 text-[15px] font-bold text-white transition active:scale-[0.98] disabled:opacity-50"
            >
              수락
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function ConfirmBody({
  nickname,
  profileImage,
  level,
  mannerTemperature,
}: {
  nickname: string;
  profileImage: string | null;
  level: Level;
  mannerTemperature: number;
}) {
  const fillWidth = `${(mannerTemperature / MAX_TEMPERATURE) * 100}%`;

  return (
    <>
      <div className="mb-4 flex flex-col items-center gap-2.5">
        <Avatar
          src={profileImage}
          name={nickname}
          size="lg"
          alt="상대 프로필 이미지"
        />
        <h3 className="m-0 mt-1 text-[20px] font-bold leading-tight tracking-tight text-gray-900">
          {nickname}
        </h3>
        <span className="inline-flex items-center rounded-full bg-mint-100 px-2.5 py-1 text-[12px] font-bold leading-none tracking-tight text-mint-600">
          {LEVEL_LABEL[level]}
        </span>
      </div>

      <div className="mb-4 rounded-[14px] bg-gray-50 px-4 py-3.5">
        <div className="mb-2.5 flex items-center justify-between">
          <span className="text-[13px] font-medium leading-none tracking-tight text-gray-600">
            매너온도
          </span>
          <span className="text-[15px] font-bold leading-none tracking-tight text-gray-900 tabular-nums">
            {mannerTemperature.toFixed(1)}°C
          </span>
        </div>
        <div
          role="img"
          aria-label={`매너온도 ${mannerTemperature.toFixed(1)}도`}
          className="relative h-[7px] overflow-visible rounded-full bg-gray-200"
        >
          <div
            className="relative h-full rounded-full bg-gradient-to-r from-mint-400 via-mint-500 to-coral-500"
            style={{ width: fillWidth }}
          />
        </div>
      </div>
    </>
  );
}

function ConfirmSkeleton() {
  return (
    <div className="flex flex-col items-center gap-3 py-6">
      <div className="h-20 w-20 animate-pulse rounded-full bg-gray-100" />
      <div className="h-5 w-32 animate-pulse rounded bg-gray-100" />
      <div className="h-4 w-20 animate-pulse rounded bg-gray-100" />
    </div>
  );
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npx vitest run src/pages/matching/MatchConfirmModal.test.tsx
```

Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/pages/matching/MatchConfirmModal.tsx src/pages/matching/MatchConfirmModal.test.tsx
git commit -m "feat(matching): MatchConfirmModal 컴포넌트 추가"
```

---

## Task 9: MatchingPage 통합

**Files:**
- Modify: `src/pages/matching/MatchingPage.tsx`
- Modify: `src/pages/matching/MatchingPage.test.tsx`

- [ ] **Step 1: 실패 테스트 추가**

`MatchingPage.test.tsx` 끝부분에 다음 케이스 추가:

```tsx
it("AWAITING_CONFIRM 응답을 받으면 MatchConfirmModal 을 표시한다", async () => {
  server.use(
    http.get("http://localhost:3000/api/v1/me/matching", () =>
      HttpResponse.json({
        data: {
          status: "AWAITING_CONFIRM",
          partnerId: 2,
          roomId: null,
          confirmDeadline: new Date(Date.now() + 15000).toISOString(),
        },
        status: 200,
        message: "OK",
      }),
    ),
  );

  renderWithQueryClient(<MatchingPage />);

  expect(
    await screen.findByRole("dialog", { name: "매칭된 상대 확인" }),
  ).toBeInTheDocument();
});

it("모달의 '수락' 클릭 시 accept 엔드포인트가 호출된다", async () => {
  const user = userEvent.setup();
  let acceptCount = 0;
  server.use(
    http.get("http://localhost:3000/api/v1/me/matching", () =>
      HttpResponse.json({
        data: {
          status: "AWAITING_CONFIRM",
          partnerId: 2,
          roomId: null,
          confirmDeadline: new Date(Date.now() + 15000).toISOString(),
        },
        status: 200,
        message: "OK",
      }),
    ),
    http.post("http://localhost:3000/api/v1/me/matching/accept", () => {
      acceptCount++;
      return HttpResponse.json({ data: null, status: 204, message: "NO_CONTENT" });
    }),
  );

  renderWithQueryClient(<MatchingPage />);

  await screen.findByRole("dialog", { name: "매칭된 상대 확인" });
  await user.click(screen.getByRole("button", { name: "수락" }));

  await waitFor(() => expect(acceptCount).toBe(1));
});

it("모달의 '거절' 클릭 시 decline 엔드포인트가 호출된다", async () => {
  const user = userEvent.setup();
  let declineCount = 0;
  server.use(
    http.get("http://localhost:3000/api/v1/me/matching", () =>
      HttpResponse.json({
        data: {
          status: "AWAITING_CONFIRM",
          partnerId: 2,
          roomId: null,
          confirmDeadline: new Date(Date.now() + 15000).toISOString(),
        },
        status: 200,
        message: "OK",
      }),
    ),
    http.post("http://localhost:3000/api/v1/me/matching/decline", () => {
      declineCount++;
      return HttpResponse.json({ data: null, status: 204, message: "NO_CONTENT" });
    }),
  );

  renderWithQueryClient(<MatchingPage />);

  await screen.findByRole("dialog", { name: "매칭된 상대 확인" });
  await user.click(screen.getByRole("button", { name: "거절" }));

  await waitFor(() => expect(declineCount).toBe(1));
});
```

기존 `MATCHED 응답을 받으면 ...` 테스트의 응답 객체에도 `confirmDeadline: null`을 추가한다 (envelope 정합성). 마찬가지로 `MATCHED 후 navigate 시에는 ...` 테스트의 응답도 동일.

- [ ] **Step 2: 테스트 실행 (실패 확인)**

```bash
npx vitest run src/pages/matching/MatchingPage.test.tsx
```

Expected: 새 케이스 FAIL

- [ ] **Step 3: `MatchingPage.tsx` 수정 — AWAITING_CONFIRM 분기 추가**

기존 코드의 `useEffect`(navigate) 다음에 다음 로직을 추가하고, 컴포넌트 JSX 끝부분 `<CancelConfirmSheet />` 위에 모달을 렌더한다.

상단 import에 다음 줄 추가:

```tsx
import { MatchConfirmModal } from "./MatchConfirmModal";
import { useAcceptMatch } from "@/domains/matching/hooks/useAcceptMatch";
import { useDeclineMatch } from "@/domains/matching/hooks/useDeclineMatch";
```

컴포넌트 본문에 다음 추가 (기존 `useMatchingStatus` 아래):

```tsx
const accept = useAcceptMatch();
const decline = useDeclineMatch();

const handleAccept = () => {
  if (accept.isPending) return;
  accept.mutate();
};

const handleDecline = () => {
  if (decline.isPending) return;
  decline.mutate(undefined, {
    onSettled: () => {
      // 결과 무관 — BE 가 다음 폴링에서 WAITING 으로 복귀시킴
    },
  });
};

const handleTimeout = () => {
  if (decline.isPending) return;
  decline.mutate();
};

const confirmData = status.data;
const showConfirmModal =
  confirmData?.status === "AWAITING_CONFIRM" &&
  confirmData.partnerId != null &&
  confirmData.confirmDeadline != null;
```

기존 `return ( <PageShell> ... </PageShell> )` 안의 `<CancelConfirmSheet />` 바로 위에 모달 렌더:

```tsx
{showConfirmModal && confirmData?.partnerId != null && confirmData.confirmDeadline != null && (
  <MatchConfirmModal
    partnerId={confirmData.partnerId}
    confirmDeadline={confirmData.confirmDeadline}
    onAccept={handleAccept}
    onDecline={handleDecline}
    onTimeout={handleTimeout}
    isResponding={accept.isPending || decline.isPending}
  />
)}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npx vitest run src/pages/matching/MatchingPage.test.tsx
```

Expected: PASS (모든 케이스)

- [ ] **Step 5: 전체 테스트 + 타입 체크**

```bash
npm test
npx tsc -p tsconfig.app.json --noEmit
```

Expected: 모두 통과

- [ ] **Step 6: 커밋**

```bash
git add src/pages/matching/MatchingPage.tsx src/pages/matching/MatchingPage.test.tsx
git commit -m "feat(matching): AWAITING_CONFIRM 단계에서 수락/거절 모달 통합"
```

---

## Task 10: 수동 검증 + BE 협의 체크리스트

**Files:** (코드 변경 없음 — 수동 검증과 협의)

- [ ] **Step 1: 개발 서버 실행 + MSW 시나리오 시뮬레이션**

`src/mocks/handlers.ts`의 `/me/matching` GET 핸들러를 임시로 시간 기반 시나리오로 바꿔서 브라우저에서 실제 흐름을 본다 (이 변경은 커밋하지 않음 — 검증 후 되돌린다):

```ts
let scenarioStart = 0;
http.get(apiUrl("/me/matching"), () => {
  const now = Date.now();
  if (scenarioStart === 0) scenarioStart = now;
  const elapsed = now - scenarioStart;

  if (elapsed < 5000) {
    return HttpResponse.json({
      data: { status: "WAITING", partnerId: null, roomId: null, confirmDeadline: null },
      status: 200, message: "OK",
    });
  }
  if (elapsed < 20000) {
    return HttpResponse.json({
      data: {
        status: "AWAITING_CONFIRM",
        partnerId: 2,
        roomId: null,
        confirmDeadline: new Date(scenarioStart + 20000).toISOString(),
      },
      status: 200, message: "OK",
    });
  }
  return HttpResponse.json({
    data: {
      status: "MATCHED",
      partnerId: 2,
      roomId: "11111111-1111-1111-1111-111111111111",
      confirmDeadline: null,
    },
    status: 200, message: "OK",
  });
}),
```

```bash
npm run dev
```

브라우저에서 매칭 페이지 진입 → 5초 후 모달 등장 → 카운트다운 진행 → 수락/거절 동작 확인.

검증 항목:
- [ ] 모달 등장 시 폴링 간격이 1초로 단축되는지 (네트워크 탭 확인)
- [ ] 카운트다운 바가 줄어들고 5초 이하에서 coral 색으로 바뀌는지
- [ ] 「수락」 클릭 시 두 버튼이 disabled되는지
- [ ] 「거절」 클릭 시 모달이 닫히고 매칭 페이지로 복귀하는지 (다음 폴링 응답으로 WAITING이 와야 자연스럽게 — 시나리오 핸들러를 조정해 검증)
- [ ] 카운트다운 만료 시 자동 decline이 호출되는지

- [ ] **Step 2: 시나리오 핸들러 되돌리기**

검증 후 `handlers.ts`를 원상복구. 임시 변경은 커밋하지 않는다.

- [ ] **Step 3: BE 팀 협의 체크리스트 공유**

Notion 스펙 §10의 오픈 이슈를 BE 팀과 공유:
- `AWAITING_CONFIRM` 상태 + `confirmDeadline` 발급 정책
- `POST /me/matching/accept` / `POST /me/matching/decline` 신설
- 거절·타임아웃 페어 10분 cooldown 구현 방식 (Redis TTL 권장)
- 작은 매칭 풀에서 cooldown이 매칭 가용성에 미치는 영향 측정

- [ ] **Step 4: App Review 제출 자료 준비 (BE 배포 후)**

BE 배포되어 두 단말로 매칭 시연이 가능해진 시점에:
- [ ] iOS TestFlight 빌드 + 빌드 번호 올림
- [ ] App Review 응답서에 "매칭 전 상대 프로필 표시 + 수락/거절 가능" 기능 영상 또는 스크린샷 첨부
- [ ] Review Notes에 demo 계정으로 양쪽 시연 방법 명시

---

## Self-Review

**Spec 커버리지 체크 (Notion 스펙 § 기준):**
- §2 상태머신 (AWAITING_CONFIRM 추가, confirmDeadline) → Task 2
- §3 신규 엔드포인트 (accept/decline) → Task 3, 5
- §4 FE 흐름 (폴링 1초 단축) → Task 6
- §5 UI 모달 (프로필 + 카운트다운 + 액션) → Task 1, 8
- §6 에지 케이스:
  - 상대 거절/타임아웃으로 WAITING 복귀 → 다음 폴링이 자연스럽게 모달 사라지게 함 (Task 6, 9에서 검증)
  - accept 실패 처리 → 토스트는 별도 follow-up. 이번 plan에서는 mutation isError 시 버튼이 재활성화되어 사용자가 다시 시도 가능하도록만 보장 (Task 8 disabled 로직)
  - 모달 떠 있을 때 페이지 이탈 → 기존 `cancelMatchingQueue` cleanup이 그대로 동작 (변경 없음)
- §7 파일 변경 → File Structure 섹션과 일치
- §8 테스트 → Task 3, 5, 6, 7, 8, 9에 모두 포함

**Placeholder 스캔:** TBD/TODO 없음 ✓ — 모든 step에 실제 코드/명령 포함.

**타입 일관성:** `MatchingStatus.confirmDeadline: string | null`, `useConfirmCountdown(deadlineIso: string | null)`, `MatchConfirmModal.confirmDeadline: string` (모달은 non-null로 진입 보장) — 일관됨.

**오픈 follow-up (이 plan 범위 아님):**
- accept/decline 네트워크 실패 시 토스트 UX — Sentry로 일단 가시화하고 빈도 확인 후 별도 작업
- 매칭 풀이 작은 초기 사용자 베이스에서 10분 cooldown 영향 측정 → BE/PM 협의

---

**Plan complete and saved to `docs/superpowers/plans/2026-05-11-match-confirm-modal.md`.**

## 실행 옵션

1. **Subagent-Driven (추천)** — Task 단위로 fresh subagent 디스패치, 사이사이 리뷰, 빠른 반복
2. **Inline Execution** — 현재 세션에서 executing-plans 스킬로 체크포인트 단위 일괄 진행

**어느 쪽으로 진행할까요?**

단, Task 1(HTML 목업)은 어느 쪽이든 사용자 시각 승인 게이트가 있으니, 거기서 한 번 호흡 끊깁니다.
