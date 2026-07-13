import type { QueryClient, QueryKey } from "@tanstack/react-query";

// 찜 등록/해제는 어느 소스에서 일어나든 이 쿼리들의 결과를 바꾼다 → 저장한 표현
// 목록·개수뿐 아니라 각 소스 카드(분석 mistake·오늘의 추천·아이스브레이커)의 별표
// 상태까지 교차 동기화한다.
export const BOOKMARK_INVALIDATE_KEYS: QueryKey[] = [
  ["expressions"],
  ["me", "stats"],
  ["analysisResult"],
  ["recommendedExpression", "daily"],
  ["icebreakers"],
];

export function invalidateBookmarkQueries(queryClient: QueryClient): void {
  for (const key of BOOKMARK_INVALIDATE_KEYS) {
    queryClient.invalidateQueries({ queryKey: key });
  }
}
