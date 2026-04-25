# 메인 페이지 구현 및 API 연동 — 설계 (Design)

작성일: 2026-04-25
관련 이슈: #12
브랜치: `feat/#12-main-page`

## 배경 및 목표

LingRing의 홈 화면(메인 페이지)을 구현하고, 두 개의 API를 연동한다.
- `GET /users/{userId}/my` — 사용자 이름 표시용
- `GET /recommended-expressions/daily` — "오늘의 표현" 카드용

목업: `lingring_main.html` (저장소 루트)
시각 토큰(민트·코랄·Pretendard·shadow): 이미 `tailwind.config.ts`에 반영됨.

## 범위 (Scope)

### 포함
- 메인 페이지 화면 구현 (greeting · 오늘의 표현 카드 · 통화 시작 hero · 하단 탭바)
- `GET /recommended-expressions/daily` 도메인 신규 추가 (api · 훅 · 타입 · 테스트)
- `GET /users/{userId}/my` 기존 훅 (`useUserMy`) 재사용
- 5xx/네트워크 에러 시 마이페이지 컨벤션 그대로 — 전체 에러 화면 + "다시 시도"
- 404 (`RECOMMENDED_EXPRESSION_NOT_FOUND`) 시 카드만 폴백 메시지로 대체
- `App.tsx`의 import 1줄을 `MainPage`로 교체

### 비포함 (YAGNI)
- 라우팅 (React Router 등) — 아직 라우터 자체가 없음. 통화 버튼·표현 카드·탭은 모두 `disabled`.
- `prefers-reduced-motion` 등 모션 접근성 옵션
- 시간대별 인사말 변형 ("좋은 아침" 등)
- 통화 시작 버튼 동작·매칭 화면 연결

## 결정 (Decisions)

### 1. 인터랙션 — 전부 `disabled`
마이페이지·UserExpressionsPage 패턴과 일관. 라우팅이 없는 현 상태에서 핸들러 노출은 의미 없고, 시각적으로만 살리는 것보다 `disabled`로 명시하는 편이 사용자에게도 명확.

### 2. 404 → 카드만 폴백 메시지
404는 "DB 0건"을 의미하는 정상 흐름의 일부. 전체 페이지를 막을 사유가 아님. 카드 외곽·배지·라벨은 유지하고 phrase 자리에 안내 문구.

### 3. 5xx/네트워크 → 전체 에러 화면 (마이페이지 컨벤션)
어느 한 쿼리든 5xx면 전체 에러 + "다시 시도". `userMy` 실패 시 이름 없는 greeting이 어색하기도 하고, 일관된 status machine을 유지하는 것이 단순함.

### 4. 404를 **api 함수에서 `null`로 흡수**
훅·페이지가 ApiError·status 코드를 알 필요 없게 하기 위해 api 단에서 404를 `null`로 변환. `useQuery`의 `isError`는 진짜 에러(5xx·네트워크)만 의미하게 됨 → 마이페이지의 status machine을 그대로 재사용 가능.

대안:
- B. ApiError를 그대로 throw + 페이지에서 status 분기 — `isError`의 의미가 깨지고 컴포넌트가 ApiError를 알아야 함. 비채택.
- C. `recommendedExpression` 도메인을 `userExpression`에 합치기 — 다른 리소스(저장한 표현 vs 추천 표현). cohesion 깨짐. 비채택.

### 5. `recommendedExpression`을 신규 도메인으로 추가
기존 `userExpression`(사용자가 저장한 표현)과 별개 리소스. 도메인 단위 분리(cohesion).

## 디렉토리 구조

```
src/domains/recommendedExpression/
├── types.ts
├── api/
│   ├── recommendedExpressionApi.ts
│   └── recommendedExpressionApi.test.ts
└── hooks/
    ├── useDailyRecommendedExpression.ts
    └── useDailyRecommendedExpression.test.tsx

src/pages/main/
├── MainPage.tsx
├── MainPage.test.tsx
├── Greeting.tsx
├── Greeting.test.tsx
├── DailyExpressionCard.tsx
├── DailyExpressionCard.test.tsx
├── CallHero.tsx
├── CallHero.test.tsx
├── BottomTabBar.tsx
└── BottomTabBar.test.tsx
```

`App.tsx`: `UserExpressionsPage` import → `MainPage` import (1줄 교체).

`BottomTabBar`는 `pages/mypage/BottomTabBar.tsx`와 별도 파일. active 탭이 다르고 라우팅이 없는 현재 props로 분리하는 것은 YAGNI 위반. 라우팅 도입 시 공용화한다.

## 도메인 (`recommendedExpression`)

### types.ts
```ts
export type DailyRecommendedExpression = {
  id: number;
  expression: string;
  meaning: string;
  createdAt: string;
};
```

### api/recommendedExpressionApi.ts
```ts
import { ApiError, httpGet } from "@/lib/http";
import type { DailyRecommendedExpression } from "../types";

export const fetchDailyRecommendedExpression =
  async (): Promise<DailyRecommendedExpression | null> => {
    try {
      return await httpGet<DailyRecommendedExpression>(
        "/recommended-expressions/daily",
      );
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return null;
      throw e;
    }
  };
```

### hooks/useDailyRecommendedExpression.ts
```ts
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { fetchDailyRecommendedExpression } from "../api/recommendedExpressionApi";
import type { DailyRecommendedExpression } from "../types";

export function useDailyRecommendedExpression():
  UseQueryResult<DailyRecommendedExpression | null, Error> {
  return useQuery({
    queryKey: ["recommendedExpression", "daily"],
    queryFn: fetchDailyRecommendedExpression,
  });
}
```

엔드포인트가 `userId`에 의존하지 않으므로 인자 없음. queryKey도 단순.

## 페이지 (`MainPage`)

### 데이터 흐름

```ts
const userMy = useUserMy(env.devUserId);
const dailyExpression = useDailyRecommendedExpression();

const status = (() => {
  if (userMy.isError || dailyExpression.isError) return "error";
  if (userMy.isPending || dailyExpression.isPending) return "loading";
  return "success";
})();

const handleRetry = () => {
  userMy.refetch();
  dailyExpression.refetch();
};
```

마이페이지(`MyPagePage.tsx`)와 동일한 패턴.

### 렌더 분기
- `loading` → mint-500 스피너 (`role="status"` `aria-label="로딩 중"`)
- `error` → "정보를 불러오지 못했어요." + "다시 시도" (mint-500 버튼)
- `success` → `<Greeting>` + `<DailyExpressionCard>` + `<CallHero>` + 하단의 `<BottomTabBar>`

### 레이아웃
- 마이페이지·UserExpressions와 동일한 폰 프레임(`viewport` + `phone` + 9:41 status bar + main 영역).
- 메인 영역 배경: `bg-gradient-to-b from-mint-50 to-white` (목업의 `linear-gradient(180deg, var(--mint-50) 0%, var(--white) 55%)`에 대응).
- 메인 영역 우상단/좌하단의 장식용 blob 두 개(blur, 약한 opacity)는 모바일 시각성을 위해 포함.

## 컴포넌트 인터페이스

### Greeting
```ts
type GreetingProps = { name: string };
```
- "안녕하세요, **{name}**님 👋" — 이름은 mint→coral 그라디언트 (`bg-gradient-to-r from-mint-500 to-coral-500 bg-clip-text text-transparent`)
- 서브: "오늘도 영어 한 걸음 더 가볼까요?" (gray-600)

### DailyExpressionCard
```ts
type DailyExpressionCardProps = { data: DailyRecommendedExpression | null };
```
- 카드 자체는 `<button type="button" disabled aria-disabled="true" aria-label="오늘의 표현 자세히 보기">`.
- `data` 있음 → 💬 배지 + 라벨("오늘의 표현") + `data.expression`(`text-title-m`) + `data.meaning`(`text-body-s gray-600`) + chevron `›`
- `data === null` → 같은 외곽 안에 라벨 + "오늘의 표현을 준비 중이에요"(`text-title-m gray-700`). meaning 줄·chevron 숨김.

### CallHero
- props 없음.
- 두 줄 힌트: "오늘은 누구와 만나게 될까요?" + "버튼을 눌러 랜덤 매칭을 시작해요"
- 펄스 링 3개 (`<span aria-hidden>` × 3, 0s/1.5s/3s 애니메이션 지연). pulse 키프레임은 컴포넌트 파일 인접 또는 `index.css`에 정의 (cohesion: 사용처와 가깝게 두기).
- 통화 시작 버튼: `<button type="button" disabled aria-disabled="true" aria-label="통화 시작하기">`. 160×160 원형, mint→coral 그라디언트, `shadow-button`, 폰 아이콘 + "통화 시작하기" 라벨.

### BottomTabBar (메인용)
- props 없음.
- 홈 (active, `aria-current="page"`, gray-900) · 대화 기록 · 마이페이지 — 세 버튼 모두 `disabled aria-disabled="true"`.

## 에러·폴백 매트릭스

| 에러 유형 | 어디서 흡수 | 화면 결과 |
|---|---|---|
| `dailyExpression` 404 | api 함수에서 `null` 변환 | `DailyExpressionCard`만 폴백, greeting/통화 버튼/탭 모두 정상 |
| `dailyExpression` 5xx/네트워크 | 훅의 `isError` | 전체 에러 화면 + 다시 시도 |
| `userMy` 모든 에러 | 훅의 `isError` | 전체 에러 화면 + 다시 시도 |

## 테스트 계획

vitest + Testing Library + MSW. 마이페이지 테스트와 동일한 패턴.

### `recommendedExpressionApi.test.ts`
1. 200 → `{ id, expression, meaning, createdAt }` 반환
2. 404 → `null` 반환 (throw 안 함)
3. 500 → `ApiError` throw

### `useDailyRecommendedExpression.test.tsx`
1. 200 → `data`에 표현 객체
2. 404 → `data === null`, `isError === false`
3. 500 → `isError === true`

### `MainPage.test.tsx`
1. 두 쿼리 200 → 이름·표현·의미·"통화 시작하기" 모두 보임
2. 표현 API 404 → "오늘의 표현을 준비 중이에요" 보임, greeting·통화 버튼 정상
3. `userMy` 5xx → 전체 에러 + "다시 시도"
4. 표현 API 5xx → 전체 에러 + "다시 시도"
5. "다시 시도" 클릭 → 두 쿼리 호출 카운트 ≥ 2
6. 로딩 중 스피너 노출
7. 통화 버튼·표현 카드·탭 모두 `disabled`

### 자식 컴포넌트 단위 테스트
- `Greeting.test.tsx`: name 텍스트 노출
- `DailyExpressionCard.test.tsx`: data 있음 → expression·meaning 노출 / `null` → 폴백 문구 노출 / 둘 다 `disabled`
- `CallHero.test.tsx`: 통화 버튼 `disabled` + `aria-label="통화 시작하기"`
- `BottomTabBar.test.tsx`: 세 버튼 `disabled`, 홈에 `aria-current="page"`

### MSW 핸들러
`test/msw/handlers.ts`에 `GET /recommended-expressions/daily` 200 디폴트 핸들러 추가. 케이스별 404/500은 각 테스트에서 `server.use(...)`로 오버라이드.

## 변경 파일 요약

신규
- `src/domains/recommendedExpression/types.ts`
- `src/domains/recommendedExpression/api/recommendedExpressionApi.ts` + 테스트
- `src/domains/recommendedExpression/hooks/useDailyRecommendedExpression.ts` + 테스트
- `src/pages/main/MainPage.tsx` + 테스트
- `src/pages/main/Greeting.tsx` + 테스트
- `src/pages/main/DailyExpressionCard.tsx` + 테스트
- `src/pages/main/CallHero.tsx` + 테스트
- `src/pages/main/BottomTabBar.tsx` + 테스트

수정
- `src/App.tsx` — import를 `MainPage`로 교체 (1줄)
- `test/msw/handlers.ts` — `GET /recommended-expressions/daily` 디폴트 핸들러 추가
- `src/index.css` — pulse 애니메이션 키프레임 추가 (또는 컴포넌트 인접 위치 사용)

## 위험 및 미해결 항목

- pulse 애니메이션 키프레임을 `index.css` 글로벌에 둘지 컴포넌트 인접 `<style>`/Tailwind 임의값으로 처리할지 — 구현 단계에서 기존 `index.css` 컨벤션 확인 후 결정.
- BE의 `RECOMMENDED_EXPRESSION_NOT_FOUND` 응답 본문 모양은 명세에 없음. api 흡수는 status 코드(404)만 보고 동작하므로 본문 모양 변화에 영향 없음.
