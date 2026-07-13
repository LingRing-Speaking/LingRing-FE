import type { QueryClient, QueryKey } from "@tanstack/react-query";

// 찜 등록/해제는 어느 소스에서 일어나든 이 쿼리들의 결과를 바꾼다 → 저장한 표현
// 목록·개수뿐 아니라 각 소스 카드(분석 mistake·오늘의 추천)의 별표 상태까지 교차 동기화한다.
//
// 아이스브레이커 랜덤 쿼리(["icebreakers"])는 일부러 제외한다. 매칭 화면에서만 쓰이는
// 휘발성 랜덤 목록이라, 무효화하면 재요청되며 서버가 새 문장을 재추첨해 사용자가 보던
// 문장이 바뀌어 버린다. 별표 상태는 그 자리 낙관적 패치로 유지되고, 다음 매칭 진입 때
// 서버에서 최신 bookmarkId 로 다시 받으므로 교차 동기화가 필요 없다.
export const BOOKMARK_INVALIDATE_KEYS: QueryKey[] = [
  ["expressions"],
  ["me", "stats"],
  ["analysisResult"],
  ["recommendedExpression", "daily"],
];

export function invalidateBookmarkQueries(queryClient: QueryClient): void {
  for (const key of BOOKMARK_INVALIDATE_KEYS) {
    queryClient.invalidateQueries({ queryKey: key });
  }
}
