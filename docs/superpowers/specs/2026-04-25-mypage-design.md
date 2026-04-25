# 마이페이지 구현 및 API 연동 — 설계 문서

- 이슈: [#8](https://github.com/LingRing-Speaking/LingRing-FE/issues/8)
- 브랜치: `feat/#8-mypage`
- 날짜: 2026-04-25

## 배경

LingRing-FE 스캐폴드는 Vite + React + TS + Tailwind 까지만 완료된 상태이며 (`src/App.tsx` 하나), 실제 화면은 아직 없다. 첫 화면으로 **마이페이지**를 구현하면서, 이후 다른 페이지들이 그대로 얹힐 수 있는 최소 인프라 (HTTP 래퍼, 서버 상태, 도메인 디렉토리) 를 함께 깔아둔다. 디자인 기준은 루트의 `lingring_mypage.html` 목업.

API 스펙은 Notion **API Endpoint** 페이지의 *User API* 섹션을 그대로 따른다.
- `GET /users/{userId}/my` → `{ id, name }`
- `GET /users/{userId}/stats` → `{ userId, level, mannerTemperature, totalCallCount, currentStreakDays, savedExpressionCount, lastStudyDate }`
- 공통 응답 래퍼: `ApiResponse<T> = { data, status, message }`

## 사전 결정 사항

| 항목 | 결정 | 근거 |
|---|---|---|
| `userId` 출처 | `.env` 의 `VITE_DEV_USER_ID` | 로그인 미구현. YAGNI — 인증은 별도 이슈 범위 |
| 뱃지 카드 | v1 에서 제거 | API 에 뱃지 카운트 엔드포인트 없음. 확정되지 않은 도메인의 자리를 미리 잡지 않음 (coupling.md) |
| 서버 상태 | TanStack Query 도입 | predictability.md 의 "API 훅은 Query 객체를 그대로 반환" 예시와 정렬, CLAUDE.md 스택 일치 |
| 라우팅 | 미도입 | 페이지가 하나뿐. 탭바 UI 는 유지하되 버튼은 disabled |
| 레벨 표시 | 영문 단어만 (`Beginner` / `Intermediate` / `Advanced`) | API 에 숫자 레벨 없음. 프론트에서 번호 매핑 만들면 결합 포인트 증가 |
| 테스트 | Vitest + RTL + jsdom + MSW | Vite 환경 표준. CLAUDE.md 의 80% 커버리지 하한 충족 필요 |

## 아키텍처

### 디렉토리 구조 (이번 PR 에서 새로 추가되는 것만)

```
src/
├── config/env.ts                    # import.meta.env 타입 안전 접근
├── lib/http.ts                      # fetch 래퍼 (ApiResponse<T> 언랩)
├── providers/QueryProvider.tsx      # QueryClientProvider wrapper
├── domains/user/
│   ├── api/userApi.ts               # fetchUserMy, fetchUserStats
│   ├── hooks/useUserMy.ts
│   ├── hooks/useUserStats.ts
│   └── types.ts                     # Level, UserMy, UserStats
└── pages/mypage/
    ├── MyPagePage.tsx               # 페이지 컴포넌트 (훅 조합)
    ├── ProfileCard.tsx              # 프로필 + 매너온도 섹션
    ├── WeeklyStats.tsx              # 주간 학습 현황 섹션
    ├── MyRecords.tsx                # 내 기록 섹션
    └── BottomTabBar.tsx             # 탭바 (스텁)

src/App.tsx                           # <QueryProvider><MyPagePage /></QueryProvider> 로 교체
.env.example                          # VITE_API_BASE_URL, VITE_DEV_USER_ID 추가
```

### 레이어 경계

| 레이어 | 책임 | 하지 않음 |
|---|---|---|
| `lib/http.ts` | URL 조합, JSON 파싱, `ApiResponse` 언랩, HTTP 에러 throw | 도메인 의미, 재시도 |
| `domains/user/api` | 엔드포인트 함수 | React, useQuery |
| `domains/user/hooks` | `useQuery` 래퍼, `UseQueryResult` 그대로 반환 | 렌더링 |
| `pages/mypage` | 훅 조합 + 렌더 + 로딩/에러 UX | HTTP 세부, 타입 정의 |

의존 방향: 페이지 → 훅 → API → http. 단방향.

## 컴포넌트 상세

### `MyPagePage.tsx`

- `useUserMy()`, `useUserStats()` 를 병렬 호출 (TanStack Query 기본 동작)
- 상태 분기: `isError > isPending > isSuccess` 우선순위로 IIFE 계산
- 로딩/에러/성공 3 케이스만 렌더 (스켈레톤 없음)

```tsx
const status = (() => {
  if (userMy.isError || userStats.isError) return "error";
  if (userMy.isPending || userStats.isPending) return "loading";
  return "success";
})();
```

### `ProfileCard.tsx`

Props:
```ts
type Props = {
  name: string;
  level: Level;
  mannerTemperature: number;
};
```

- 이니셜: `name.charAt(0)`
- 레벨 칩: 파일 상단 로컬 `LEVEL_LABEL: Record<Level, string>` 매핑
- 매너온도 바: `width = (mannerTemperature / MAX_TEMPERATURE) * 100 + "%"`, `MAX_TEMPERATURE = 99` 로컬 상수
- 매너온도 문구: v1 고정 문구 `평소에 친절한 대화를 하고 있어요`. 구간별 분기 필요 시 `getTemperatureDescription(temp)` 헬퍼로 분리
- 편집 버튼: 시각만 유지, `disabled`

### `WeeklyStats.tsx`

Props:
```ts
type Props = {
  currentStreakDays: number;
  totalCallCount: number;
};
```

- 2 칸 그리드, `StatCard` 를 별도 추출하지 않고 인라인 2 회 (coupling.md: "확신 없는 중복은 추상화하지 말고")

### `MyRecords.tsx`

Props:
```ts
type Props = {
  savedExpressionCount: number;
};
```

- 단일 `list-row` ("저장한 표현 N개"). 클릭 핸들러 없음 — 상세 페이지는 별도 이슈.

### `BottomTabBar.tsx`

- 3 탭 하드코딩. 현재 탭 (마이페이지) 만 active
- 홈·대화기록 버튼은 `disabled` + `aria-disabled="true"`
- 라우터 도입 PR 에서 `<Link>` 로 교체

## 데이터 흐름

### 환경 (`config/env.ts`)

```ts
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
const devUserIdRaw = import.meta.env.VITE_DEV_USER_ID;

if (!apiBaseUrl) throw new Error("VITE_API_BASE_URL is not set");
if (!devUserIdRaw) throw new Error("VITE_DEV_USER_ID is not set");

export const env = {
  apiBaseUrl,
  devUserId: Number(devUserIdRaw),
};
```

부팅 시점에 실패. 로그인 PR 에서 교체될 접점 (`authStore.userId ?? env.devUserId`).

### HTTP 래퍼 (`lib/http.ts`)

```ts
type ApiResponse<T> = { data: T; status: number; message: string };

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function httpGet<T>(path: string): Promise<T> {
  const res = await fetch(`${env.apiBaseUrl}${path}`);
  const body = await res.json();

  if (!res.ok) {
    throw new ApiError(res.status, body.message ?? "Unknown error");
  }
  return (body as ApiResponse<T>).data;
}
```

- `ApiResponse<T>` 는 내부에서 언랩. 소비자는 `data` 만 받음.
- `ApiError` 는 `status` + `message` 만 보존. Notion 스펙상 응답 `message` 는 ErrorCode 의 사람용 문장 (예: `"사용자를 찾을 수 없습니다."`) 이고 ErrorCode 이름 자체는 응답에 없음. 코드 분기가 필요해지는 시점 (백엔드가 `errorCode` 필드를 추가하거나, status 만으로 불충분할 때) 에 확장.

### API 함수 (`domains/user/api/userApi.ts`)

```ts
export const fetchUserMy = (userId: number) =>
  httpGet<UserMy>(`/users/${userId}/my`);

export const fetchUserStats = (userId: number) =>
  httpGet<UserStats>(`/users/${userId}/stats`);
```

### 훅 (`domains/user/hooks/useUserMy.ts` · `useUserStats.ts`)

```ts
export function useUserMy(userId: number): UseQueryResult<UserMy, Error> {
  return useQuery({
    queryKey: ["user", userId, "my"],
    queryFn: () => fetchUserMy(userId),
  });
}
```

쿼리키 패턴: `["user", userId, <section>]`.

### QueryProvider (`providers/QueryProvider.tsx`)

```tsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});
```

### 타입 (`domains/user/types.ts`)

```ts
export type Level = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";

export type UserMy = {
  id: number;
  name: string;
};

export type UserStats = {
  userId: number;
  level: Level;
  mannerTemperature: number;
  totalCallCount: number;
  currentStreakDays: number;
  savedExpressionCount: number;
  lastStudyDate: string | null;
};
```

`BigDecimal` 은 JSON 으로 `number` 전달. precision/scale 보존 필요해지면 `string` 으로 변경.

## 에러 / 로딩 UX

| 조건 | 화면 |
|---|---|
| 둘 중 하나라도 `isError` | 중앙 메시지 "정보를 불러오지 못했어요." + "다시 시도" 버튼 |
| 둘 중 하나라도 `isPending` | 중앙 스피너 |
| 둘 다 `isSuccess` | 정상 렌더 |

- ErrorCode (USER_NOT_FOUND 등) 별 분기: v1 없음. 사용자 액션이 모든 케이스에서 "재시도" 로 동일하기 때문.
- 스켈레톤 UI: v1 없음. 스피너 하나. 실제 지연 관측 후 튜닝.
- TanStack Query `retry` 기본값 (3회 지수 백오프) 유지. 404 진짜 "사용자 없음" 시 낭비가 문제되면 `retry: (failureCount, error) => !(error instanceof ApiError) || error.status !== 404` 로 조정.

## 테스트 전략

### 도구

- Vitest + @testing-library/react + jsdom
- MSW 로 fetch 모킹 (통합 테스트까지 동일 핸들러 재사용)
- `@vitest/coverage-v8`, threshold 80%

### 파일 공존

`*.test.ts(x)` 를 소스와 같은 디렉토리에 둔다.

### 테스트 헬퍼

```
test/utils/renderWithQueryClient.tsx   # 새 QueryClient 로 wrap
test/msw/handlers.ts                    # happy-path 핸들러
test/setup.ts                           # server.listen(), resetHandlers
```

개별 테스트는 `server.use(http.get(...))` 로 케이스별 오버라이드.

### 레이어별 케이스

| 레이어 | 케이스 |
|---|---|
| `lib/http.ts` | 2xx → data 언랩 / 4xx → ApiError throw / 네트워크 실패 → throw |
| `domains/user/api` | URL 경로 매칭 |
| `domains/user/hooks` | `renderHook` + QueryClient wrapper — data/isSuccess/error |
| `ProfileCard` | 이니셜, LEVEL_LABEL 3 종, 매너온도 바 너비 |
| `WeeklyStats` | 숫자 표시 2 개 |
| `MyRecords` | 저장한 표현 카운트 |
| `BottomTabBar` | active/disabled 속성 |
| `MyPagePage` | 통합 — loading → success, error + refetch, 한 쿼리만 error |

### 커버리지 제외

- `providers/QueryProvider.tsx` — 4 줄 래퍼
- `src/main.tsx`, `src/App.tsx` — wire-up
- `config/env.ts` 의 throw 분기는 1 케이스 테스트로 덮음

`vitest.config.ts` 의 `coverage.exclude` 에 명시.

### 80% 달성 전망

순수 컴포넌트·훅·http 는 각각 2–4 케이스로 90%+, 페이지 통합 테스트가 상태 분기 3 + 재시도 1 을 덮어 전체 85%+ 예상.

100% 는 목표하지 않음 — 타입 narrowing 방어 경로는 도달 불가일 수 있고, 강제하면 신호가 흐려진다.

## 범위 밖

- 로그인·인증 저장·토큰 갱신
- 프로필 편집 · 저장한 표현 상세 · 뱃지
- 홈·대화기록·설정 화면
- React Router, 탭바 네비게이션 실동작
- 스켈레톤 UI
- ErrorCode 별 개별 분기 처리
- Sentry, 푸시 알림, Capacitor 래핑
