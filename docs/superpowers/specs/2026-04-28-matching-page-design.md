# 매칭 페이지 설계 (Matching Page Design)

- 작성일: 2026-04-28
- 상태: 승인 대기
- 대응 목업: `lingring_matching.html`
- 대응 백엔드 API: `GET /icebreakers`

## 1. 목표와 범위

### 목표
- `lingring_matching.html` 목업을 React + TypeScript + Tailwind 기반으로 포팅한다.
- 매칭 대기 중 사용자에게 보여줄 회화 시작 문장(아이스브레이커)을 백엔드에서 받아 7초 간격으로 회전시킨다.
- 메인 페이지의 통화 시작 버튼에서 매칭 페이지로 진입할 수 있도록 라우팅을 연결한다.

### 범위 안
- `/matching` 라우트와 매칭 페이지 UI (브리딩 오브, 도트 인디케이터, 상태 메시지, 아이스브레이커 회전 카드, 취소 시트)
- 아이스브레이커 도메인 (`src/domains/icebreaker/`) 및 TanStack Query 훅
- 메인 페이지 통화 버튼 (`CallHero`) 활성화 + `/matching` 네비게이션
- 위 코드에 대응하는 단위 테스트 (커버리지 80%+ 유지)

### 범위 밖
- 매칭 성공 시뮬레이션 / `/call` 라우트 — 통화 페이지는 별도 작업으로 다룬다.
- 실제 매칭 알고리즘 / WebRTC 시그널링 / TURN — 백엔드·인프라 영역.
- 매칭 성공 알림 푸시, 취소 후 매칭 통계 등 부가 기능.

## 2. 사용자 흐름

```
[메인]                       [매칭]                          [메인]
 통화 버튼  ──navigate──▶  대기 화면 + 회전 문장   ──cancel──▶ 메인 복귀
                              │
                              └─ 닫기/취소 → 시트 → "취소하기" → /
```

1. 사용자가 메인의 통화 버튼을 누른다 → `/matching`으로 이동.
2. 마운트 즉시 폴백 문장 5개로 회전 시작 (7s 간격, 280ms 페이드 전환).
3. 동시에 `GET /icebreakers?count=5` 호출. 응답이 오면 카드 문장을 API 결과로 교체. 회전 인덱스는 그대로 유지.
4. 호출이 실패하면 폴백 문장으로 계속 회전 (사용자에게 별도 에러 메시지 노출하지 않음).
5. 사용자가 우측 상단 닫기(✕) 또는 하단 "매칭 취소" 버튼 → 동일한 confirm 시트 노출.
6. 시트에서 "계속 기다리기" → 시트 닫기. "취소하기" → `/`로 navigate.

## 3. 라우팅

`src/App.tsx`에 라우트 추가:

```tsx
<Route path="/matching" element={<MatchingPage />} />
```

매칭 페이지에는 `BottomTabBar`를 포함하지 않는다 (목업과 동일하게 풀스크린).

메인 페이지의 `CallHero`(`src/pages/main/CallHero.tsx`)는 현재 버튼이 disabled 상태. 다음과 같이 변경:

- `disabled` 제거
- `useNavigate()` 훅으로 `/matching` 이동
- 클릭 핸들러에서 `navigate('/matching')`

## 4. 도메인 레이어

### 디렉토리 구조

```
src/domains/icebreaker/
├── types.ts
├── api/
│   ├── icebreakerApi.ts
│   └── icebreakerApi.test.ts
└── hooks/
    ├── useRandomIcebreakers.ts
    └── useRandomIcebreakers.test.tsx
```

기존 `user`, `userExpression`, `recommendedExpression` 도메인과 동일한 레이아웃을 따른다.

### 타입

```ts
// types.ts
export type Icebreaker = {
  id: number;
  expression: string;
  meaning: string;
  createdAt: string; // ISO-8601
};
```

### API 함수

```ts
// api/icebreakerApi.ts
import { httpGet } from "@/lib/http";

type IcebreakerListResponse = { items: Icebreaker[] };

export const fetchRandomIcebreakers = async (count = 5): Promise<Icebreaker[]> => {
  const res = await httpGet<IcebreakerListResponse>(`/icebreakers?count=${count}`);
  return res.items;
};
```

응답 envelope (`{ data, status, message }`)는 `httpGet`이 이미 unwrap하므로 함수에서는 `data` 안의 `items`만 추출해 배열로 반환한다.

### 쿼리 훅

```ts
// hooks/useRandomIcebreakers.ts
import { useQuery } from "@tanstack/react-query";
import { fetchRandomIcebreakers } from "../api/icebreakerApi";

const DEFAULT_COUNT = 5;

export const useRandomIcebreakers = (count: number = DEFAULT_COUNT) =>
  useQuery({
    queryKey: ["icebreakers", "random", count],
    queryFn: () => fetchRandomIcebreakers(count),
    staleTime: 0,        // 매번 새 문장을 받기 위해 캐시 사용 안 함
    gcTime: 0,           // 매칭 페이지 재진입 시 새 fetch
    refetchOnMount: "always",
  });
```

이유: 백엔드가 `ORDER BY RAND()`로 매 호출마다 다른 결과를 반환하므로, 페이지 재진입 시 동일 문장을 보여주지 않도록 캐시를 끈다.

## 5. 페이지 / 컴포넌트 구조

```
src/pages/matching/
├── MatchingPage.tsx           # 컨테이너 (라우트 entry)
├── MatchingPage.test.tsx
├── BreathingOrb.tsx           # 시각용 (오브 + halo + dots)
├── IcebreakerRotator.tsx      # 회전 카드 + 진행 도트
├── IcebreakerRotator.test.tsx
├── CancelConfirmSheet.tsx     # 바텀시트
├── useSentenceRotation.ts     # 회전 타이머 훅
├── useSentenceRotation.test.ts
└── fallbackIcebreakers.ts     # 5개 하드코딩 폴백
```

### 책임 분리

- **`MatchingPage`**: TanStack Query 훅 호출, 시트 open/close 상태, navigate. 자식에게 props 전달만.
- **`BreathingOrb`**: 순수 시각 컴포넌트. 외부 props 없음 (오브 클릭 시뮬은 범위 외이므로 onClick prop 없음).
- **`IcebreakerRotator`**: `sentences: Icebreaker[]` prop을 받아 회전 카드 + 진행 도트 렌더링. 폴백을 default prop이 아니라 컨테이너에서 주입한다 (폴백 문장은 도메인 layer가 아니라 매칭 페이지의 UX 결정이므로 page 폴더에 둠).
- **`useSentenceRotation`**: `(items, intervalMs)` 입력 → `{ index, currentItem, isSwapping }` 반환. 페이드 타이밍(280ms)도 훅 내부에서 관리. items가 바뀌어도 index는 유지하고 길이만 다시 계산.
- **`CancelConfirmSheet`**: `open`, `onKeep`, `onCancel` props. 트랜지션은 목업의 transform/opacity 방식 그대로 Tailwind 클래스로 포팅. 외부 라이브러리 (Radix 등) 사용하지 않음 — 현재 단계에서 YAGNI.

### MatchingPage 의사코드

```tsx
const ICEBREAKER_COUNT = 5;
const ROTATION_INTERVAL_MS = 7000;

function MatchingPage() {
  const navigate = useNavigate();
  const [sheetOpen, setSheetOpen] = useState(false);
  const { data } = useRandomIcebreakers(ICEBREAKER_COUNT);

  const sentences = data ?? FALLBACK_ICEBREAKERS;

  return (
    <div className="viewport flex min-h-dvh items-center justify-center bg-[#E7EAEE] p-6">
      <div className="phone relative h-[812px] w-[375px] overflow-hidden rounded-[44px] bg-white shadow-[0_0_0_10px_#1A1D22,0_30px_60px_rgba(0,0,0,0.25)] md:h-dvh md:w-full md:rounded-none md:shadow-none">
        <header>...status bar 9:41...</header>
        <main>
          <TopBar onClose={() => setSheetOpen(true)} />
          <BreathingOrb />
          <StatusMessage />
          <IcebreakerRotator sentences={sentences} intervalMs={ROTATION_INTERVAL_MS} />
          <CancelButton onClick={() => setSheetOpen(true)} />
        </main>
        <CancelConfirmSheet
          open={sheetOpen}
          onKeep={() => setSheetOpen(false)}
          onCancel={() => navigate("/")}
        />
      </div>
    </div>
  );
}
```

**페이지 래퍼**: `MainPage`(`src/pages/main/MainPage.tsx`)가 사용하는 viewport/phone 클래스 구조를 인라인 그대로 복사한다. 별도 `PhoneFrame` 컴포넌트로 추상화하지 않는다 — 추상화는 사용처가 3곳 이상이고 변경이 같이 가는 게 확인된 다음에 한다 (`coupling.md`: 확신 없는 중복은 추상화하지 말고 남겨둬라).

**시트 위치**: `CancelConfirmSheet`의 backdrop과 sheet는 `position: absolute`이므로 phone 컨테이너 안쪽에 놓는다 (목업 구조와 동일). 백드롭 클릭 시 시트 닫기는 "계속 기다리기"와 동일하게 처리.

**매직 넘버**: 회전 간격 / 페이드 duration / 폴백 개수 등은 사용처 파일 상단에 named const로 둔다 (`readability.md`, `cohesion.md`).

### 폴백 문장

```ts
// fallbackIcebreakers.ts
import type { Icebreaker } from "@/domains/icebreaker/types";

export const FALLBACK_ICEBREAKERS: Icebreaker[] = [
  { id: -1, expression: "How's your week going so far?", meaning: "이번 주 어떻게 보내고 계세요?", createdAt: "" },
  { id: -2, expression: "What brought you to LingRing?", meaning: "LingRing은 어떻게 알게 되셨어요?", createdAt: "" },
  { id: -3, expression: "Do you have any fun plans this weekend?", meaning: "이번 주말에 재미있는 계획 있으세요?", createdAt: "" },
  { id: -4, expression: "What's something you've been into lately?", meaning: "요즘 빠져 있는 게 있나요?", createdAt: "" },
  { id: -5, expression: "Have you been anywhere interesting recently?", meaning: "최근에 어디 재밌는 곳 다녀오셨어요?", createdAt: "" },
];
```

폴백 항목의 id는 음수로 두어 실제 서버 데이터(양수 id)와 충돌하지 않도록 한다.

## 6. 스타일

- 목업의 인라인 CSS는 모두 Tailwind 클래스로 포팅. (기존 `MainPage` 등 페이지 컨벤션 일치)
- `tailwind.config.ts`에 mint/coral/gray 토큰은 이미 존재. 다음만 추가:
  - `boxShadow.orb`: `0 20px 50px rgba(31, 191, 146, 0.25)`
  - `keyframes.breathe` (3.6s 순환 scale)
  - `keyframes.halo` (3.6s 순환 scale + opacity)
  - `keyframes.dotBlink` (1.4s 순환 opacity + translateY)
  - 위 keyframes에 대응하는 `animation` 항목
- 페이드 전환 (회전 카드)은 Tailwind `transition-{opacity,transform} duration-300` 으로 구현하고, swap 상태는 컴포넌트 className으로 토글.
- 도트 회전 진행 상태(`active` 도트가 가로로 늘어나는 효과)는 Tailwind `transition-all duration-200`으로 구현.

## 7. 테스트 계획

기존 패턴 (Vitest + MSW + React Testing Library) 그대로 따른다.

### 단위 테스트

| 파일 | 케이스 |
| --- | --- |
| `icebreakerApi.test.ts` | 200 응답 시 `items` 배열 반환 / 에러 응답 시 `ApiError` throw / `count` query string이 URL에 포함되는지 |
| `useRandomIcebreakers.test.tsx` | 성공 시 `data`로 배열 반환 / 에러 시 `isError === true` |
| `useSentenceRotation.test.ts` | `vi.useFakeTimers`로 7초 경과 시 인덱스 +1, 마지막 인덱스 다음은 0으로 wrap, items 길이가 바뀌어도 wrap 인덱스 재계산 |
| `IcebreakerRotator.test.tsx` | 초기 첫 문장 렌더 / 7초 후 두 번째 문장 렌더 / `active` 도트가 같이 이동 |
| `MatchingPage.test.tsx` | 닫기 버튼 클릭 시 시트 표시 / "계속 기다리기" 시 시트 닫힘 / "취소하기" 시 `/`로 navigate (mock `useNavigate`) / API 응답이 오기 전에는 폴백 문장이 카드에 보임 |

### 추가 검증
- 기존 `MainPage` 테스트가 깨지지 않는지 (`CallHero` 변경 영향).
- 전체 `npm run test:run` 통과 + `npm run typecheck` + `npm run lint` 통과.
- `npm run coverage` 결과 80%+ 유지.

## 8. 결정 기록

| 결정 | 이유 |
| --- | --- |
| 매칭 성공 시뮬레이션 제거 | `/call` 페이지 미구현. YAGNI. 통화 페이지 작업 시 함께 붙임. |
| 폴백 문장 즉시 표시 | 매칭 대기 화면은 정적 시간이 길고, 빈 카드는 어색. 학습 가치도 유지됨. |
| API 실패해도 에러 미노출 | 폴백으로 정상 회전이 유지되므로 사용자 입장에서는 식별 불가. 매칭 자체에 영향 없음. |
| `staleTime: 0`, `gcTime: 0` | 백엔드가 매 호출마다 무작위 결과 반환. 같은 사용자에게 같은 문장 반복 노출 방지. |
| Radix 등 외부 시트 라이브러리 미도입 | 단일 시트 사용. CSS 트랜지션으로 충분. 도입 시점은 시트가 2곳 이상 생기거나 접근성 요구가 명시될 때. |
| 폴백 문장 위치는 `pages/matching/` 아래 | 폴백은 도메인 모델이 아니라 매칭 페이지의 UX 폴백. 도메인 디렉토리는 백엔드 표현으로만 유지. |

## 9. 참고

- 디자인 토큰 출처: `lingring_brand.html`
- 응답 envelope/`httpGet` 구현: `src/lib/http.ts`
- 도메인 레이어 레퍼런스: `src/domains/user/` (api → hooks → types)
- 페이지 레퍼런스: `src/pages/main/MainPage.tsx`, `src/pages/mypage/`
