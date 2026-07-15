# 문장(표현) 찜하기 설계

- 이슈: [#174 feat: 문장 찜하기 기능 추가](https://github.com/LingRing-Speaking/LingRing-FE/issues/174)
- 작성일: 2026-07-13
- 브랜치: `feat/#174-sentence-bookmark`

## 1. 목표 & 범위

사용자가 앱 곳곳에서 노출되는 영어 표현을 **별표(★)로 찜**하고, 찜한 표현을 기존
**"저장한 표현" 화면**(`/expressions`)에서 모아본다. 찜은 토글이다 — 별표를 누르면
불이 들어오고(채워짐) 다시 누르면 삭제 API를 쏜다.

### 찜 소스 (3곳, 확정)

| # | 소스 | 위치 | 저장 매핑 | 캐시 키 |
|---|---|---|---|---|
| ① | Analysis mistake | `AnalysisResultPage`의 "이렇게 말해보세요" 카드 | `improved`→`expression`, `koMeaning`→`meaning` | `["analysisResult", analysisId]` |
| ② | 오늘의 추천 표현 | `MainPage`의 `DailyExpressionCard` | `expression`, `meaning` | `["recommendedExpression","daily",date]` |
| ③ | IceBreaker | `MatchingPage`의 `IcebreakerRotator`(캐러셀) | `expression`, `meaning` | `["icebreakers","random",count]` |

세 소스 모두 찜하면 같은 `/expressions` 컬렉션에 수렴한다. 해제는 각 소스 카드의
별표 + "저장한 표현" 목록 카드 양쪽에서 가능하다.

### 범위 밖 (YAGNI)

- 통화 트랜스크립트 원시 발화 찜 (뜻이 없어 매핑 불가 — 이번엔 제외)
- 폴더/태그 분류, 검색, 정렬 옵션
- BE의 meaning 자동 번역/생성

## 2. 데이터 계약 (→ LingRing-BE 초안)

### 2.1 타입 변경

세 소스 아이템에 `bookmarkId`를 추가한다. `bookmarkId !== null` 이면 "찜됨"이며,
그 값이 곧 `/expressions` row id다. 재방문 시 BE가 이 값을 실어주므로 별표 상태가
유지된다.

```ts
// src/domains/callHistory/types.ts
export type MistakeItem = {
  id: number;                // 신규: 분석 내 mistake 식별자 (POST 시 지목 + 캐시 패치 키)
  tag: FeedbackTag;
  wrong: string;
  improved: string;
  reason: string;
  koMeaning: string;
  bookmarkId: number | null; // 신규
};

// src/domains/recommendedExpression/types.ts
export type DailyRecommendedExpression = {
  id: number;
  expression: string;
  meaning: string;
  createdAt: string;
  bookmarkId: number | null; // 신규
};

// src/domains/icebreaker/types.ts
export type Icebreaker = {
  id: number;
  expression: string;
  meaning: string;
  createdAt: string;
  bookmarkId: number | null; // 신규
};
```

### 2.2 엔드포인트

```ts
type BookmarkSource =
  | { source: "ANALYSIS_MISTAKE"; analysisId: number; mistakeId: number }
  | { source: "DAILY_EXPRESSION"; recommendedExpressionId: number }
  | { source: "ICEBREAKER"; icebreakerId: number };
```

| 동작 | 요청 | 응답 |
|---|---|---|
| 찜 등록 | `POST /expressions` body `BookmarkSource` | 생성된 `UserExpression { id, userId, expression, meaning, createdAt }` |
| 찜 해제 | `DELETE /expressions/{id}` (body 없음) | 204 |

- BE가 서버에서 소스별로 `expression`/`meaning`을 채운다(클라가 텍스트를 보내지
  않음 → 위변조 방지, 뜻 일관성 보장).
- 중복 찜 방지: BE가 `(user, source, sourceId)` 유니크로 처리. 이미 찜된 소스에
  POST가 오면 기존 row를 그대로 반환(멱등).
- 삭제를 `/expressions/{id}` 하나로 통일 → 소스 카드(=`bookmarkId`)와 목록
  카드(=`item.id`)가 같은 엔드포인트를 쓴다.
- **BE 합의 포인트**: 위 "삭제 통일" 대신 소스별 액션 엔드포인트
  (`POST/DELETE /analyses/{id}/mistakes/{id}/bookmark` 등)로 갈지. 메모리의
  "body 필요한 액션은 POST 액션 endpoint" 관례와 저울질. 본 설계는 통일안 채택.

## 3. FE 구조

### 3.1 API 레이어 (`domains/userExpression/api/bookmarkApi.ts` 신규)

```ts
export const createBookmark = (source: BookmarkSource) =>
  httpPost<UserExpression>("/expressions", source);

export const deleteExpression = (id: number) =>
  httpDelete<void>(`/expressions/${id}`);
```

### 3.2 공유 토글 훅 (`domains/userExpression/hooks/useToggleBookmark.ts` 신규)

세 소스는 mutation·무효화 로직이 동일하고 **캐시 패치 방식만** 다르다(배열 항목 vs
단일 객체). 이 진짜 공통부만 훅으로 묶고, 캐시 형태 차이는 호출부 어댑터(`patch`)에
남긴다.

```ts
useToggleBookmark<TData>({
  queryKey,                         // 낙관적 패치·롤백 대상 캐시
  patch,                            // (data, nextBookmarkId) => data'  해당 아이템의 bookmarkId 교체
}): { toggle: (currentBookmarkId, createBody) => void; isPending }
```

- `toggle` 동작: `currentBookmarkId === null` → `createBookmark(createBody)` 후
  실제 id 반영 / 아니면 `deleteExpression(currentBookmarkId)` 후 null.
- `onMutate`: `cancelQueries(queryKey)` → 스냅샷 → `setQueryData(queryKey,
  patch(next))`. 등록은 실제 id 오기 전 임시 sentinel(예: `Number.MAX_SAFE_INTEGER`)로
  "찜됨" 표시 후 `onSuccess`에서 실제 id로 교체.
- `onError`: 스냅샷으로 롤백 + 토스트("저장에 실패했어요").
- `onSettled` 무효화(전 소스 공통): `["expressions"]`, `["me","stats"]`,
  `["analysisResult"]`, `["recommendedExpression","daily"]`, `["icebreakers"]`.
  → 교차 화면(목록에서 해제 시 소스 카드도, 소스에서 찜 시 목록/개수도) 동기화.

### 3.3 목록 삭제 훅 (`domains/userExpression/hooks/useDeleteExpression.ts` 신규)

"저장한 표현" 목록에서 카드 삭제. 무한쿼리 캐시(`["expressions"]`)에서 낙관적 제거 +
롤백. 무효화는 3.2와 동일 세트(소스 카드 별표 상태까지 동기화).

## 4. UI

### 4.1 공유 별표 버튼 (`domains/userExpression/components/BookmarkStarButton.tsx` 신규)

세 소스가 공유하는 프레젠테이션 컴포넌트.

```ts
type Props = { active: boolean; pending: boolean; onToggle: () => void };
```

- 미찜: 외곽선 별(회색). 찜됨: 채워진 별 + 브랜드 액센트(coral) "불 들어옴".
- `aria-pressed={active}`, `aria-label`은 "찜하기"/"찜 해제". `pending` 동안 disabled
  (연타 방지).

### 4.2 소스별 통합

- **① mistake 카드**: 우상단에 별표. `MistakeItem`에 `id` 도입에 맞춰 렌더 key를
  index → `item.id`로 교체. 어댑터는 `["analysisResult", analysisId]` 안의
  `mistakes[].bookmarkId`를 교체.
- **② 오늘의 추천 카드**: 현재 전체가 `disabled` 버튼 → 비대화 컨테이너(`article`)로
  리팩터하고 내부에 별표(`data` 있을 때만, "준비 중" 상태엔 없음). 어댑터는
  daily 쿼리의 단일 객체 `bookmarkId` 교체.
- **③ IceBreaker**: **current 슬롯 카드에만** 별표(prev/next 슬롯은 표시용).
  버튼 탭이 캐러셀 스와이프/자동회전으로 번지지 않도록 `onTouchStart`/`onClick`에서
  `stopPropagation`. **폴백(id < 0) 아이스브레이커엔 별표 미노출**. 어댑터는
  `["icebreakers","random",count]` 배열 항목의 `bookmarkId` 교체.
- **④ 저장한 표현 `PhraseCard`**: 우측에 삭제 버튼 추가(별표 해제와 동일 효과).
  `id` prop 필요 → 시그니처 확장. `useDeleteExpression` 사용.

## 5. 에러 처리 & 엣지 케이스

- 낙관적 토글 실패 → 롤백 + 토스트. (기존 토스트 유틸 재사용 여부는 구현 시 확인,
  없으면 최소 구현.)
- 연타(더블 토글): mutation in-flight 동안 별표 disabled.
- 폴백 아이스브레이커(음수 id): 서버에 없으므로 별표 자체를 렌더하지 않는다.
- 캐러셀 회전 중 찜: 낙관적 상태가 쿼리 캐시에 있어 슬라이드/재등장 후에도 유지.
- 이미 찜된 소스 재-POST: BE 멱등 처리로 중복 row 생성 안 됨.

## 6. 테스트 (커버리지 ≥ 80% 유지)

- `bookmarkApi.test.ts`: `POST /expressions` source 분기 바디, `DELETE` 경로, 에러 매핑.
- `useToggleBookmark.test.tsx`: 3개 어댑터(mistake/daily/icebreaker) 각각 낙관적
  토글·실패 롤백·무효화 호출.
- `useDeleteExpression.test.tsx`: 낙관적 제거·롤백.
- `BookmarkStarButton.test.tsx`: active/ pending 렌더, 클릭 콜백, a11y 속성.
- UI 통합: `AnalysisResultPage`(mistake 별표), `DailyExpressionCard`(준비중 미노출),
  `IcebreakerRotator`(current만·폴백 미노출·전파 차단), `PhraseCard`(삭제).
- `mocks/handlers.ts`: `POST /expressions`(source 분기), `DELETE /expressions/:id` 추가.

## 7. 파일 변경 요약

신규:
- `domains/userExpression/api/bookmarkApi.ts`
- `domains/userExpression/hooks/useToggleBookmark.ts`
- `domains/userExpression/hooks/useDeleteExpression.ts`
- `domains/userExpression/components/BookmarkStarButton.tsx`
- 각 대응 테스트

수정:
- `domains/callHistory/types.ts` (`MistakeItem`에 `id`, `bookmarkId`)
- `domains/recommendedExpression/types.ts` (`bookmarkId`)
- `domains/icebreaker/types.ts` (`bookmarkId`)
- `pages/analysis/AnalysisResultPage.tsx` (mistake 별표)
- `pages/main/DailyExpressionCard.tsx` (컨테이너 리팩터 + 별표)
- `pages/matching/IcebreakerRotator.tsx` (current 슬롯 별표 + 전파 차단)
- `pages/userExpressions/PhraseCard.tsx` (삭제 버튼, `id` prop)
- `mocks/handlers.ts` (찜 등록/해제 핸들러)
