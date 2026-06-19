# 통화 기록 페이지 설계 (Call History Page Design)

- 작성일: 2026-04-29
- 상태: 승인 대기
- 대응 GitHub 이슈: [#21 feat: 통화 기록 페이지 구현](https://github.com/LingRing-Speaking/FE/issues/21)
- 디자인 목업: 저장소 루트의 `lingring_history.html`
- 대응 백엔드 API (이번 작업에서 신설 — BE 미준비):
  - `GET /users/{userId}/calls?page=N&size=M` — 통화 기록 페이지 조회

## 1. 목표와 범위

### 목표

- 사용자가 자신의 1:1 영어 회화 통화 내역을 시간순 그룹("오늘", "이번 주", "이번 달", "M월")으로 확인할 수 있다.
- 무한 스크롤로 과거 통화를 끝까지 탐색할 수 있다.
- 통화 카드의 액션 버튼은 `analyzed` 여부에 따라 "분석하기"/"분석 보기"로 분기되며, 양쪽 모두 분석 화면 라우트로 이동한다.
- 백엔드가 아직 통화 기록 엔드포인트를 제공하지 않으므로, **FE 안에서 mock 데이터를 끝까지 그릴 수 있는 dev 환경**(MSW 브라우저 worker)을 함께 도입한다.

### 범위 안

- 통화 기록 도메인 (`src/domains/callHistory/`) — types, API 호출, 무한 쿼리 훅
- 통화 기록 페이지 (`src/pages/callHistory/`) — 페이지 컨테이너, 그룹별 리스트, 카드, 빈 상태, 시간 그룹핑·메타 포맷 순수 함수
- `App.tsx`에 `/history` 라우트 등록
- MSW 인프라 재배치 — 핸들러를 `test/msw/`에서 `src/mocks/`로 이동, dev/test 공용화
- 브라우저용 MSW worker 도입 — `VITE_MSW=on`일 때만 dev에서 동작
- 통화 기록 mock 핸들러 + 50건 가량의 시드 데이터 (오늘/이번 주/이번 달/지난 달들에 분산)
- 위 코드에 대응하는 단위 테스트 + 커버리지 80% 이상 유지

### 범위 밖

- **분석 페이지**: 라우트 자체는 등록하지 않는다. 카드 액션은 `useNavigate("/calls/:id/analysis")`만 호출하고, 그 라우트와 페이지 구현은 후속 이슈.
- **카드 본문 클릭 → 프로필 모달** (목업의 매너온도/친구추가/신고 모달 3단). 본문 클릭 핸들러는 빈 함수 + TODO 주석으로 자리만 둔다.
- **친구 추가 / 신고 API** — 위 모달 후속 이슈에서 디자인.
- **로딩·에러 디자인 시안 적용** — 목업에 로딩/에러 화면이 없어 텍스트 기반으로만 처리. 디자인 시안 도착 시 후속 PR.
- **풀-투-리프레시 / `staleTime` 튜닝** — TanStack Query 기본값.

## 2. 사용자 흐름

```
[홈/마이페이지의 탭바]
        │ "대화 기록" 탭 탭
        ▼
[/history 진입]
   마운트 → useCallHistory (GET /users/{userId}/calls?page=0&size=20)
        │
        ├─ pending  → "불러오는 중" 텍스트
        ├─ error    → "통화 기록을 불러오지 못했어요." + 다시 시도
        ├─ items.length === 0 → <EmptyCallHistory/>
        └─ success  → 시간 그룹핑 → <CallHistoryList/>
                          │
                          └─ 스크롤 끝 sentinel 진입 →
                             hasNext && !isFetchingNextPage 이면 fetchNextPage()
                                                                          │
                                                                          ▼
                                                              page=1, page=2, ... 누적

[카드 우측 액션 버튼 클릭]
   analyzed === false → "분석하기" → navigate("/calls/{id}/analysis")
   analyzed === true  → "분석 보기" → navigate("/calls/{id}/analysis")

[카드 본문 클릭]
   현재 스코프에서는 noop (TODO 주석 — 프로필 모달 이슈에서 연결)
```

## 3. 아키텍처

### 디렉토리 구조 (신규)

```
src/
├── domains/callHistory/
│   ├── types.ts
│   ├── api/
│   │   ├── callHistoryApi.ts
│   │   └── callHistoryApi.test.ts
│   └── hooks/
│       ├── useCallHistory.ts
│       └── useCallHistory.test.tsx
├── pages/callHistory/
│   ├── CallHistoryPage.tsx
│   ├── CallHistoryPage.test.tsx
│   ├── CallHistoryList.tsx
│   ├── CallCard.tsx
│   ├── CallCard.test.tsx
│   ├── EmptyCallHistory.tsx
│   ├── EmptyCallHistory.test.tsx
│   ├── timeBucket.ts
│   └── timeBucket.test.ts
└── mocks/                           # ← test/msw/에서 이동
    ├── handlers.ts                  # dev/test 공용
    ├── browser.ts                   # NEW — dev용 setupWorker
    └── server.ts                    # 기존 test/msw/server.ts 이동

public/
└── mockServiceWorker.js             # NEW — `npx msw init public/`로 생성, 커밋
```

### 변경되는 파일

- `src/App.tsx` — `<Route path="/history" element={<CallHistoryPage/>} />` 한 줄 추가
- `src/main.tsx` — dev에서 `VITE_MSW=on`일 때만 worker.start() 호출
- `test/setup.ts` — `test/msw/server` import 경로를 `src/mocks/server`로 변경
- `.env.example` — `VITE_MSW=off` 옵션 한 줄 추가

### 설계 원칙

- 도메인은 `callHistory` (camelCase) — 기존 `userExpression`, `recommendedExpression` 패턴과 일관.
- 시간 그룹핑·메타 포맷은 **표시 로직**이므로 `pages/callHistory/timeBucket.ts`에 둠 (도메인이 아니라 페이지 응집). 순수 함수로 만들어 단위 테스트.
- 무한 쿼리는 `useUserExpressions`와 동일한 `useInfiniteQuery + hasNext` 패턴 — 패턴 학습 비용 0 (`predictability.md`).
- MSW 핸들러는 `src/mocks/`로 이동하여 dev/test 공용 — 같은 mock 데이터를 두 번 들고 있지 않게 (`coupling.md`).

## 4. API 인터페이스

### 엔드포인트

```
GET /users/{userId}/calls?page=0&size=20
```

기존 `/users/{userId}/expressions`, `/users/{userId}/matching`와 동일한 user 종속 리소스 패턴.

### 응답 스키마 (`{data, status, message}` 래퍼는 `httpGet`이 벗겨줌)

```ts
// src/domains/callHistory/types.ts
export type CallHistoryItem = {
  id: number;
  partner: { id: number; name: string };
  startedAt: string;       // ISO 8601 (예: "2026-04-29T19:30:00+09:00")
  durationSec: number;     // 양의 정수
  analyzed: boolean;       // false → "분석하기" / true → "분석 보기"
};

export type CallHistoryList = {
  items: CallHistoryItem[];
  hasNext: boolean;
};
```

- **정렬**: `startedAt` 내림차순 (서버 책임). 클라이언트는 받은 순서를 유지하며 그룹핑만 한다.
- **partner**: 후속 모달 이슈에서 매너온도·레벨 필드가 추가될 자리이므로 nested 객체로 시작 — 호출처 파급을 줄임.
- **id 타입**: 기존 도메인과 동일하게 `number`.
- **빈 페이지**: `{ items: [], hasNext: false }`로 응답 — 별도 404 처리 없음.

### `api/callHistoryApi.ts`

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

### `hooks/useCallHistory.ts`

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

`useUserExpressions`와 동일 패턴 — 일관성을 위해 `PAGE_SIZE`도 동일하게 20.

## 5. 시간 그룹핑·메타 포맷 (`pages/callHistory/timeBucket.ts`)

목업의 그룹 헤더와 카드 메타 텍스트가 시간대에 따라 다른 형태로 그려지는 로직을 두 개의 순수 함수로 캡슐화한다. DOM·i18n 라이브러리 의존 없이 `now: Date`만 주입받아 결정적으로 계산한다.

### 그룹 분류

```ts
export type Bucket = "today" | "thisWeek" | "thisMonth" | "byMonth";

export type CallGroup = {
  bucket: Bucket;
  label: string;
  items: CallHistoryItem[];
};

export function classifyCalls(
  items: CallHistoryItem[],
  now: Date,
): CallGroup[];
```

분류 규칙 (KST 기준, 모두 `now`와의 비교):

| Bucket     | 조건                                              | 라벨     |
| ---------- | ------------------------------------------------- | -------- |
| `today`    | `startedAt`이 `now`와 같은 달력 날짜              | `"오늘"` |
| `thisWeek` | 이번 주 (월요일 0시 ~ 어제 23:59:59)              | `"이번 주"` |
| `thisMonth`| 이번 달인데 이번 주 이전                          | `"이번 달"` |
| `byMonth`  | 그 이전 — 통화의 월별로 따로 그룹                 | `"M월"`  |

세부:

- **주의 시작**은 월요일 0시. 한국어 사용자 대상 앱이므로.
- `byMonth`는 작년 이전이라도 `"M월"`로만 표시 (목업에 연도 라벨 없음). 연도 보강은 후속.
- 빈 그룹은 결과에 포함하지 않음 (오늘 통화가 없으면 `"오늘"` 헤더 안 보임).
- 응답이 시간 내림차순이라는 전제로 **들어온 순서를 유지**하며 group-by — 정렬 책임은 서버.

### 메타 텍스트 포맷

```ts
export function formatCallMeta(
  startedAt: Date,
  durationSec: number,
  now: Date,
): string;
```

목업 예시: `"오늘 오후 7:30 · 5:23"`, `"3일 전 · 7:12"`, `"4월 12일 · 8:20"`.

규칙:

| 시점                  | 시각부 형식           |
| --------------------- | --------------------- |
| `today`               | `"오늘 오전/오후 H:MM"` |
| `thisWeek` (어제 포함)| `"N일 전"` (1~6)      |
| 그 이전               | `"M월 D일"`           |

뒤의 `· M:SS`는 항상 `Math.floor(durationSec/60):durationSec%60` (초 2자리 패딩).

### 결정 사항

- **`now` 주입**: 두 함수 모두 `now: Date`를 인자로 받는다. 컴포넌트에서는 `useMemo(() => classifyCalls(items, new Date()), [items])`. 테스트가 fake timer 없이 결정적.
- **로케일 직접 조립**: `Intl.DateTimeFormat`을 사용하지 않고 문자열을 직접 만든다. 런타임 로케일에 따라 결과가 달라지지 않으며 테스트 안정성 ↑.

## 6. 페이지 컴포넌트 구조

### `CallHistoryPage`

```tsx
export function CallHistoryPage() {
  const userId = env.devUserId;
  const query = useCallHistory(userId);

  if (query.isPending) return <LoadingState />;
  if (query.isError) return <ErrorState onRetry={() => query.refetch()} />;

  const items = query.data.pages.flatMap((p) => p.items);
  if (items.length === 0) return <EmptyCallHistory />;

  return (
    <CallHistoryList
      items={items}
      hasNextPage={query.hasNextPage}
      isFetchingNextPage={query.isFetchingNextPage}
      onLoadMore={query.fetchNextPage}
    />
  );
}
```

`LoadingState` / `ErrorState`는 같은 파일 내 작은 로컬 컴포넌트(목업 디자인 부재 — 텍스트 기반).

### `CallHistoryList`

```tsx
type Props = {
  items: CallHistoryItem[];
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
};

export function CallHistoryList({ items, hasNextPage, isFetchingNextPage, onLoadMore }: Props) {
  const groups = useMemo(() => classifyCalls(items, new Date()), [items]);
  const sentinelRef = useIntersectionObserverTrigger(() => {
    if (hasNextPage && !isFetchingNextPage) onLoadMore();
  });

  return (
    <div className="...">
      <h1 className="...">대화 기록</h1>
      {groups.map((g) => (
        <section key={`${g.bucket}-${g.label}`}>
          <h2 className="...">{g.label}</h2>
          <div className="...">
            {g.items.map((c) => <CallCard key={c.id} call={c} />)}
          </div>
        </section>
      ))}
      <div ref={sentinelRef} />
    </div>
  );
}
```

`useIntersectionObserverTrigger`는 같은 파일 내 작은 훅 (사용처 1개라 도메인 폴더로 승격하지 않음, `cohesion.md`). 매칭 폴링 훅의 cleanup 패턴을 따라 unmount 시 observer를 disconnect한다.

### `CallCard`

```tsx
type Props = { call: CallHistoryItem };

export function CallCard({ call }: Props) {
  const navigate = useNavigate();
  const meta = formatCallMeta(new Date(call.startedAt), call.durationSec, new Date());
  const initial = call.partner.name[0] ?? "?";

  return (
    <div className="call-card">
      <button
        className="call-main"
        onClick={() => { /* TODO: 프로필 모달 이슈에서 연결 */ }}
      >
        <div className="avatar"><span>{initial}</span></div>
        <div>
          <span className="call-name">{call.partner.name}</span>
          <span className="call-meta">{meta}</span>
        </div>
      </button>
      <button
        className={call.analyzed ? "call-action ghost" : "call-action primary"}
        onClick={() => navigate(`/calls/${call.id}/analysis`)}
      >
        {call.analyzed ? "분석 보기" : "분석하기"}
      </button>
    </div>
  );
}
```

분석 버튼의 텍스트·스타일 분기는 한 줄 차이라 인라인 삼항으로 충분 (`readability.md` — 단순 1회성 조건은 그대로 둔다).

### `EmptyCallHistory`

목업의 `.empty` 스타일을 차용 (이모지 + h3 + p). 텍스트:

- 제목: `"아직 통화 기록이 없어요"`
- 부연: `"첫 통화를 시작해보세요."`

(카피는 디자이너 검토 후 변경 가능 — 구조만 확정.)

## 7. 라우팅

`src/App.tsx`:

```tsx
<Route path="/history" element={<CallHistoryPage />} />
```

URL은 `/history` — 짧고 브랜드상 "대화 기록"이 단일 영역이라 `/calls` 같은 리소스 컬렉션 의미보다 자연스럽다. (BE의 리소스 path `/users/{userId}/calls`와는 별개의 URL 명명 — FE 라우트는 사용자가 보는 화면 이름.)

`/calls/:callId/analysis` 라우트는 분석 페이지 이슈에서 등록. 이번 PR에서는 `useNavigate` 호출만 일어나며, 현재 `App.tsx`에 catch-all NotFound 라우트가 없으므로 클릭 시 React Router는 빈 화면(매칭되는 라우트 없음)을 그린다 — **의도된 placeholder**. spec에 명시해 PR 리뷰 시 혼선 방지.

## 8. MSW dev 인프라

### 파일 이동

`test/msw/handlers.ts` → `src/mocks/handlers.ts`
`test/msw/server.ts` → `src/mocks/server.ts`

이동하는 이유는 dev 빌드(Vite)가 번들에 포함시킬 수 있는 경로(`src/`)에 두어야 브라우저에서 동적 import 가능하기 때문.

`test/setup.ts`의 import 경로를 갱신.

### 신규: `src/mocks/browser.ts`

```ts
import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

export const worker = setupWorker(...handlers);
```

### 신규: `public/mockServiceWorker.js`

```bash
npx msw init public/ --save
```

생성된 worker 스크립트는 **커밋한다** — MSW 표준이며 빌드 산출물이 아닌 패키지에서 복사된 정적 자원이다.

### `src/main.tsx` 부트스트랩

```tsx
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

핵심:

- **dynamic import** — `VITE_MSW=off`이면 `src/mocks/*`가 prod 번들에 포함되지 않는다.
- `onUnhandledRequest: "bypass"` — mock 안 만든 엔드포인트는 진짜 BE로 흘려보냄. 부분 mock 가능.
- `import.meta.env.DEV` 가드 — prod 빌드에서는 절대 worker가 켜지지 않는다.
- 명시적 opt-in (`VITE_MSW=on`) — 평소 dev는 진짜 BE 호출 그대로 유지.

### env

`.env.example`에 한 줄 추가:

```
# 개발 중에 백엔드 mock(MSW)을 켜려면 on. 평소엔 off로 진짜 BE 호출.
VITE_MSW=off
```

`.env.test`는 건드리지 않는다 (테스트는 `setupServer`로 동작, env와 무관).

### 통화 기록 mock 핸들러

`src/mocks/handlers.ts`에 추가 (`generateFakeCalls`는 같은 파일 내 로컬 함수 — 사용처가 1곳이므로 별도 파일로 빼지 않음, `cohesion.md`):

```ts
import { http, HttpResponse } from "msw";

function generateFakeCalls(n: number): CallHistoryItem[] {
  // now 기준 상대 시간으로 오늘/이번 주/이번 달/지난 달들에 분산되도록 시드
  // (예: hoursAgo = [1, 4, 26, 26*3, 26*5, 24*30, 24*60, ...])
  // 매일 자동으로 그룹 분포가 자연스럽게 갱신됨
}

const fakeCalls: CallHistoryItem[] = generateFakeCalls(50);

http.get("*/users/:userId/calls", ({ request }) => {
  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page") ?? 0);
  const size = Number(url.searchParams.get("size") ?? 20);
  const slice = fakeCalls.slice(page * size, page * size + size);
  return HttpResponse.json({
    data: { items: slice, hasNext: (page + 1) * size < fakeCalls.length },
    status: 200,
    message: "OK",
  });
}),
```

## 9. 빈 상태·로딩·에러 처리

| 상태                           | UI                                                               |
| ------------------------------ | ---------------------------------------------------------------- |
| `query.isPending`              | 페이지 영역에 `"불러오는 중"` 텍스트 한 줄 (디자인 후속)         |
| `query.isError`                | `"통화 기록을 불러오지 못했어요. 다시 시도해주세요."` + 재시도 버튼 → `query.refetch()` |
| `data && items.length === 0`   | `<EmptyCallHistory />`                                           |
| `data && items.length > 0`     | `<CallHistoryList />`                                            |

목업에 로딩·에러 디자인이 없으므로 텍스트만으로 동작 보장. 디자인 시안 도착 시 후속 PR — spec에 명시해 PR 리뷰 시 "왜 디자인 안 따랐냐" 묻지 않도록.

## 10. 테스트 전략

### `src/pages/callHistory/timeBucket.test.ts` — **커버리지 1순위**

순수 함수라 케이스를 풍부하게 — 페이지 전체 커버리지의 안전망.

- `classifyCalls`
  - 오늘 0시 1분 / 어제 23시 59분 → 다른 그룹 (`today` vs `thisWeek`)
  - 이번 주 월요일 0시 / 일요일 23시 59분 (지난 주 마지막) → `thisWeek` vs `thisMonth` 또는 `byMonth`
  - 이번 달 1일 / 지난 달 마지막 → `thisMonth` vs `byMonth`
  - 4월 통화·3월 통화 동시 입력 → 두 `byMonth` 그룹 분리, 라벨이 각각 `"4월"`, `"3월"`
  - 빈 그룹은 결과에 포함되지 않음
  - 입력 순서 유지
- `formatCallMeta`
  - `9초` → `0:09`
  - `605초` → `10:05`
  - 자정·정오 경계의 오전/오후 변환
  - `오늘`/`N일 전`/`M월 D일` 분기 각각

### `src/domains/callHistory/api/callHistoryApi.test.ts`

- `fetchCallHistory(userId, page, size)`가 정확한 URL을 만드는지
- 응답 매핑 (`CallHistoryList` 반환)
- 4xx/5xx → `ApiError` throw

### `src/domains/callHistory/hooks/useCallHistory.test.tsx`

- 첫 페이지 로드 후 `data.pages[0].items` 노출
- `hasNext: true`일 때 `fetchNextPage` 호출 → 두 번째 페이지 누적
- `hasNext: false`일 때 `hasNextPage === false`

### `src/pages/callHistory/CallCard.test.tsx`

- `analyzed=false` → "분석하기" 노출, 클릭 시 `navigate("/calls/{id}/analysis")` 호출
- `analyzed=true` → "분석 보기" 노출, 동일 navigate
- 본문 클릭은 noop (이번 스코프)

### `src/pages/callHistory/EmptyCallHistory.test.tsx`

- 빈 상태 텍스트 렌더 (스냅샷 X — 텍스트로 직접 검증)

### `src/pages/callHistory/CallHistoryPage.test.tsx`

- 그룹 헤더 렌더 순서 (오늘 → 이번 주 → 이번 달 → byMonth)
- 빈 응답일 때 `EmptyCallHistory` 렌더
- 에러 시 재시도 버튼 클릭 → `refetch` 호출
- sentinel이 뷰포트에 들어오면 `fetchNextPage` 호출 (IntersectionObserver를 vi.stubGlobal로 mock)

### MSW 기반 통합

테스트는 모두 `src/mocks/handlers.ts`를 통해 동작. `useNavigate`는 `MemoryRouter` + spy 라우트 또는 `vi.mock("react-router-dom")` 중 기존 테스트가 쓰는 패턴을 따른다.

### 커버리지 목표

CLAUDE.md 규칙: **80% 이상 유지**. timeBucket 테스트가 가장 무거운 부분 — 케이스를 넉넉히 두면 페이지 전체 커버리지 안전권.

## 11. 알려진 한계 / 비-스코프

- 카드 본문 클릭 → 프로필 모달 (매너온도/친구추가/신고) — 별도 이슈
- 분석 페이지 (라우트 + 페이지 컴포넌트 + 분석 결과 표시) — 별도 이슈
- 친구 추가 / 신고 API 디자인 — 모달 이슈에서 함께
- 풀-투-리프레시 — 현재 미지원
- `staleTime` 등 캐시 정책 튜닝 — 기본값 사용
- 로딩·에러 디자인 시안 적용 — 시안 도착 시 후속 PR
- `byMonth` 그룹의 연도 보강 (예: `"2025년 4월"`) — 사용자가 1년 이상 사용했을 때만 의미가 생기므로 후속

## 12. 마이그레이션·롤아웃

- BE의 `GET /users/{userId}/calls`가 준비되면 `.env`에서 `VITE_MSW=off` (또는 그 줄 제거)만으로 즉시 실 데이터 동작.
- `src/mocks/handlers.ts`의 통화 기록 핸들러는 BE 안정화 후에도 테스트 환경(`server.ts`)에서 계속 사용 → 제거하지 않는다.
