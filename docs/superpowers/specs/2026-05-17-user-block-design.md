# 사용자 차단 기능 설계 (User Block)

- 이슈: [#109](https://github.com/LingRing-Speaking/LingRing-FE/issues/109)
- 작성일: 2026-05-17
- 상태: 설계 합의 완료 / 구현 대기
- 선행 의존성: 없음 (BE `GET /blocks` 응답이 `nickname`/`profileImage`를 이미 포함, 2026-05-17 정정)

## 1. 목적

신고와 별개로 "차단만 하고 싶다"는 사용자 의도를 지원한다. 현재는 신고하면 자동 차단되는 구조만 존재하며, 신고 없이 차단만 수행하는 액션이 없다.

이 기능을 추가하면 사용자는:

1. 상대 프로필에서 "차단" 버튼을 눌러 해당 사용자를 차단할 수 있다.
2. 차단한 사용자 목록을 설정에서 조회할 수 있다.
3. 목록에서 차단을 해제할 수 있다.

## 2. 합의된 결정

| 결정                | 값                                            | 근거                                                              |
| ------------------- | --------------------------------------------- | ----------------------------------------------------------------- |
| 신고와 차단 관계    | **신고 = 신고 + 차단 / 차단 = 차단만**        | 기존 신고 흐름 유지하면서 가벼운 차단 액션을 분리                 |
| 통화 중 차단 동작   | **차단 API만 호출, 통화는 유지**              | 의도 명확. 현재 통화 영향 없음 (BE 부수효과는 다음 매칭부터 적용) |
| 이슈 스코프         | **차단 + 차단 목록/해제 화면 포함**           | 사용자가 사용 가능한 완성도 우선                                  |
| 차단 목록 진입점    | **설정 페이지에 "차단 관리" 신규 섹션**       | "도움말", "계정"과 동등한 별도 섹션                               |
| 차단 목록 응답 형태 | **`nickname`, `profileImage` 포함** (§10)         | UI 의미성 확보 (N+1 호출 회피)                                    |
| 차단 성공 피드백    | **`ReportModal` 패턴의 2단계 완료 카드**      | 명시적 확인, 신고와 일관                                          |
| 해제 성공 피드백    | **완료 카드 없이 행 제거가 피드백**           | 가벼운 액션, 목록 갱신이 시각 신호                                |

## 3. UI 변경

### 3.1 `PartnerProfileModal` — 두 버튼 노출

현재 하단 `[신고하기]` 단일 버튼 → `[차단하기] [신고하기]` 가로 배치.

- 컨테이너: `flex justify-center gap-10` (구분선 없음)
- 차단: `text-gray-700`, underline, 회색
- 신고: `text-coral-600`, underline (기존 그대로)
- 시각 위계: 신고가 더 무거운 액션이라는 신호 (코랄 vs 회색)

### 3.2 `BlockConfirmModal` — 차단 확인 + 완료 (2단계)

`ReportModal`의 backdrop/z-index/Escape 처리를 그대로 답습한다.

**Step 1 — 확인 카드**

- 제목: "이 사용자를 차단할까요?"
- 본문: "차단하면 서로 매칭에서 만나지 않아요. 설정 > 차단 관리에서 언제든 해제할 수 있어요."
- 버튼: `[취소] [차단]` (gray-100 / coral-500)
- 차단 실패 시 카드 안에 코랄 에러 메시지 + 재시도 가능

**Step 2 — 완료 카드** (차단 성공 후 자동 전환)

- 체크 아이콘 (`bg-mint-100` 원형 + `stroke-mint-500`)
- 제목: "차단했어요"
- 본문: "설정 > 차단 관리에서 언제든 해제할 수 있어요."
- 버튼: `[확인]` (`bg-mint-500`, 전체 너비)
- 확인 탭 시 BlockConfirmModal과 PartnerProfileModal 모두 닫힘

### 3.3 `UnblockConfirmModal` — 해제 확인 (1단계)

- 제목: "{닉네임}님의 차단을 해제할까요?"
- 본문: "다시 매칭에서 만날 수 있어요."
- 버튼: `[취소] [해제]` (gray-100 / coral-500)
- 성공 시 즉시 닫힘, 목록에서 행 제거가 피드백
- 실패 시 카드 안에 에러 메시지

### 3.4 `SettingsPage` — 신규 섹션

"도움말"과 "계정" 사이에 "차단 관리" 섹션 추가.

```
도움말 [문의하기 / 이용약관 / 개인정보처리방침]
─────────────────
차단 관리                          ← 신규
  └─ 차단한 사용자  ›              → navigate('/settings/blocks')
─────────────────
계정 [로그아웃 / 탈퇴하기]
```

### 3.5 `BlockListPage` — 차단 목록 화면

라우트: `/settings/blocks` (`OnboardedRoutes` 하위)

`CallHistoryPage`와 동일한 상태 분기:

- 헤더: `[< 뒤로]` + 가운데 "차단한 사용자" (`SettingsPage` 헤더 마크업 답습, `navigate(-1)`로 뒤로가기)
- `loading` → 스피너 (`CallHistoryPage`와 동일)
- `error` → "차단 목록을 불러오지 못했어요" + 다시 시도
- `empty` → `EmptyBlockList` ("아직 차단한 사용자가 없어요")
- `success` → `BlockedUserList`

`BlockedUserItem` 행 구조:

```
[아바타]  닉네임                            [해제]
         2026.05.10 차단
```

- 아바타: 32–40px (작은 사이즈), `Avatar` 컴포넌트 재사용
- 닉네임: `text-[15px] font-semibold`
- 일자: `text-[12.5px] text-gray-500`, "YYYY.MM.DD 차단" 포맷 (`createdAt`은 KST ISO 문자열, `Intl.DateTimeFormat('ko-KR')`로 변환)
- 해제 버튼: 우측, `text-[13px] font-semibold text-coral-600` 텍스트 버튼 (테두리 없음). 신고 모달의 "신고하기" 톤과 일관.

행의 "해제" 탭 → `UnblockConfirmModal` 열림.

`BottomTabBar` 없음 (하위 페이지).

## 4. 파일 구조

### 신규 도메인: `src/domains/block/`

```
domains/block/
├── types.ts
├── api/
│   ├── blockApi.ts
│   └── blockApi.test.ts
├── hooks/
│   ├── useBlockUser.ts
│   ├── useBlockUser.test.tsx
│   ├── useUnblockUser.ts
│   ├── useUnblockUser.test.tsx
│   ├── useBlockedUsers.ts
│   └── useBlockedUsers.test.tsx
└── components/
    ├── BlockConfirmModal.tsx
    ├── BlockConfirmModal.test.tsx
    ├── UnblockConfirmModal.tsx
    └── UnblockConfirmModal.test.tsx
```

### 신규 페이지: `src/pages/blockList/`

```
pages/blockList/
├── BlockListPage.tsx
├── BlockListPage.test.tsx
├── BlockedUserList.tsx
├── BlockedUserItem.tsx
└── EmptyBlockList.tsx
```

### 수정

- `src/domains/user/components/PartnerProfileModal.tsx` — `onBlock` prop 추가, 두 버튼 가로 배치
- `src/pages/call/CallPage.tsx` — `BlockConfirmModal` 마운트, `isBlockOpen` 상태 추가
- `src/pages/callHistory/CallHistoryPage.tsx` — 동일 패턴
- `src/pages/settings/SettingsPage.tsx` — "차단 관리" 섹션 추가
- `src/App.tsx` — `/settings/blocks` 라우트 추가
- `src/mocks/handlers.ts` — 차단 3개 엔드포인트 핸들러 추가

## 5. 타입 (`domains/block/types.ts`)

POST 응답과 GET items 모양이 다르다 — POST는 차단 레코드(`userId` 포함), GET items는 Projection 기반 카드(`nickname/profileImage` 포함, `userId` 없음). 두 타입을 분리한다.

```ts
// POST /blocks 응답 (차단 레코드)
export type Block = {
  id: number;
  userId: number;
  blockedUserId: number;
  createdAt: string; // ISO LocalDateTime, KST
};

// GET /blocks items 항목 (UI 표시용 Projection)
export type BlockListItem = {
  id: number;
  blockedUserId: number;
  nickname: string;
  profileImage: string | null;
  createdAt: string;
};

export type BlockListResponse = {
  items: BlockListItem[];
  hasNext: boolean;
};

export type BlockCreateInput = {
  blockedUserId: number;
};
```

## 6. API (`domains/block/api/blockApi.ts`)

```ts
import { httpDelete, httpGet, httpPost } from "@/lib/http";
import type { Block, BlockCreateInput, BlockListResponse } from "../types";

const BLOCKS_PATH = "/blocks";

export const createBlock = (input: BlockCreateInput): Promise<Block> =>
  httpPost<Block>(BLOCKS_PATH, input);

export const deleteBlock = (blockedUserId: number): Promise<void> =>
  httpDelete(`${BLOCKS_PATH}/${blockedUserId}`);

export const fetchBlockedUsers = (page: number, size: number): Promise<BlockListResponse> =>
  httpGet<BlockListResponse>(`${BLOCKS_PATH}?page=${page}&size=${size}`);
```

`httpGet/httpPost/httpDelete`는 BE envelope (`{ data, status, message }`)에서 `data`만 추출해 반환. 멱등 동작(이미 차단된 사용자 재차단, 없는 사용자 해제)은 BE가 200/204로 응답하므로 FE 추가 처리 불필요.

## 7. Hooks

### `useBlockUser`

```ts
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { createBlock } from "../api/blockApi";
import type { Block, BlockCreateInput } from "../types";

export function useBlockUser(): UseMutationResult<Block, Error, BlockCreateInput> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createBlock,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blocks"] });
    },
  });
}
```

### `useUnblockUser`

```ts
export function useUnblockUser(): UseMutationResult<void, Error, number> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteBlock,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blocks"] });
    },
  });
}
```

### `useBlockedUsers` (`useCallHistory` 답습)

```ts
const PAGE_SIZE = 20;

export function useBlockedUsers(): UseInfiniteQueryResult<
  InfiniteData<BlockListResponse, number>,
  Error
> {
  return useInfiniteQuery({
    queryKey: ["blocks"],
    queryFn: ({ pageParam }) => fetchBlockedUsers(pageParam, PAGE_SIZE),
    initialPageParam: 0,
    getNextPageParam: (lastPage, _allPages, lastPageParam) =>
      lastPage.hasNext ? lastPageParam + 1 : undefined,
  });
}
```

## 8. 컴포넌트 시그니처

### `BlockConfirmModal`

```ts
type Props = {
  partnerId: number | null;
  open: boolean;
  onClose: () => void; // 완료 카드 "확인" 탭 시 호출 (양쪽 모달 모두 닫기 위한 콜백)
  onCancel: () => void; // Step1 "취소" 탭 시 호출 (이 모달만 닫기)
};
```

- 내부: `useBlockUser()` mutation
- `submission.isSuccess === true` → 완료 카드(Step 2) 표시
- 그 외 → 확인 카드(Step 1) 표시
- `submission.isError` → Step 1 카드 내부에 에러 메시지

### `UnblockConfirmModal`

```ts
type Props = {
  target: { id: number; nickname: string } | null;
  open: boolean;
  onClose: () => void; // 해제 성공 시 호출
  onCancel: () => void; // 취소 시 호출
};
```

- 내부: `useUnblockUser()` mutation
- 성공 시 `onClose()` 호출 (행 제거가 피드백)
- 실패 시 카드 내부에 에러 메시지 + 재시도 가능

### `PartnerProfileModal` (시그니처 변경)

```ts
type Props = {
  partnerId: number | null;
  open: boolean;
  onClose: () => void;
  onReport: () => void;
  onBlock: () => void; // 추가
};
```

### `BlockListPage` 내부 상태

```ts
const [unblockTarget, setUnblockTarget] = useState<{ id: number; nickname: string } | null>(null);
```

## 9. CallPage / CallHistoryPage 통합 패턴

```tsx
const [isReportOpen, setIsReportOpen] = useState(false);
const [isBlockOpen, setIsBlockOpen] = useState(false);

<PartnerProfileModal
  partnerId={partnerId}
  open={isProfileOpen && !isReportOpen && !isBlockOpen}
  onClose={() => setIsProfileOpen(false)}
  onReport={() => setIsReportOpen(true)}
  onBlock={() => setIsBlockOpen(true)}
/>

<ReportModal
  partnerId={isReportOpen ? partnerId : null}
  open={isReportOpen}
  onClose={() => { setIsReportOpen(false); setIsProfileOpen(false); }}
  onCancel={() => setIsReportOpen(false)}
/>

<BlockConfirmModal
  partnerId={isBlockOpen ? partnerId : null}
  open={isBlockOpen}
  onClose={() => { setIsBlockOpen(false); setIsProfileOpen(false); }}
  onCancel={() => setIsBlockOpen(false)}
/>
```

`isProfileOpen && !isReportOpen && !isBlockOpen` — 자식 모달이 열리면 부모 카드를 숨겨 backdrop이 중첩되지 않게 한다 (기존 `ReportModal` 패턴 그대로).

## 10. BE 명세 (2026-05-17 정정 반영)

`GET /blocks` 응답 (`UserBlocksResponse`):

```json
{
  "items": [
    {
      "id": 2,
      "blockedUserId": 3,
      "nickname": "민트",
      "profileImage": "https://.../abc.jpg",
      "createdAt": "..."
    }
  ],
  "hasNext": true
}
```

- items 항목은 BE Projection (`UserBlockItemProjection`) 기반. `userId`는 클라이언트가 토큰으로 알 수 있어 응답에서 제외.
- `POST /blocks` 응답은 별도 — `{ id, userId, blockedUserId, createdAt }` (`UserBlockResponse`).

## 11. 에러 처리

| 시나리오                               | 동작                                                                               |
| -------------------------------------- | ---------------------------------------------------------------------------------- |
| 차단 생성 네트워크 실패                | Step1 카드 내부 코랄 에러 메시지 + 차단 버튼 재활성                                |
| 차단 생성 400 `SELF_BLOCK_NOT_ALLOWED` | 발생 불가능 케이스(자기 프로필 모달 미존재). fallback으로 동일 에러 표시           |
| 차단 생성 401                          | `httpRequest`가 자동 refresh 후 재시도 → 그래도 실패하면 강제 로그아웃 (전역 동작) |
| 해제 실패                              | `UnblockConfirmModal` 카드 내부 에러 + 재시도                                      |
| 목록 fetch 실패                        | "차단 목록을 불러오지 못했어요" + 다시 시도 버튼 (`CallHistoryPage`와 동일)        |

## 12. 테스트 전략

CLAUDE.md 기준 80% 이상 커버리지 유지.

- `blockApi.test.ts` — MSW로 3개 엔드포인트 happy/error 케이스
- `useBlockUser.test.tsx` — 성공 시 `['blocks']` invalidate 검증
- `useUnblockUser.test.tsx` — 동일 패턴
- `useBlockedUsers.test.tsx` — 무한 스크롤 페이지 누적, `hasNext` 분기
- `BlockConfirmModal.test.tsx` — Step1 ↔ Step2 전환, 취소, 에러 표시
- `UnblockConfirmModal.test.tsx` — 확인, 취소, 에러 표시
- `BlockListPage.test.tsx` — loading/error/empty/list, 해제 트리거
- `PartnerProfileModal.test.tsx` — 기존 테스트에 `onBlock` 호출 케이스 추가
- `CallPage.test.tsx` / `CallHistoryPage.test.tsx` — 기존 테스트에 차단 모달 마운트/닫힘 케이스 추가
- `src/mocks/handlers.ts` — POST `/blocks`, DELETE `/blocks/:id`, GET `/blocks` 핸들러 추가

## 13. 스코프 밖

- 차단 사용자의 채팅/통화 차단 로직 (BE 매칭 정책이 처리)
- 신고 도메인 카피 변경 (기존 "신고하면 자동 차단" 유지)
- 토스트 시스템 도입 (현재 미존재, 본 이슈에서도 도입하지 않음)
- 차단 사유 수집 (요구사항상 불필요)
- 차단 통계/대시보드

## 14. 마일스톤

1. FE: 도메인 `domains/block/` 신설 (API + hook + 타입 + 테스트)
2. FE: `BlockConfirmModal` 구현 + `PartnerProfileModal` 연동
3. FE: `CallPage` / `CallHistoryPage` 통합
4. FE: `BlockListPage` + `UnblockConfirmModal` 구현
5. FE: `SettingsPage` 섹션 추가 + 라우트 등록
6. FE: 테스트 정비 + 커버리지 확인
7. PR 생성 (`Closes #109`)
