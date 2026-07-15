import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { searchFriend } from "../api/friendApi";
import { friendKeys } from "../queryKeys";
import type { FriendSearchResult } from "../types";

/**
 * 닉네임 정확 일치 검색. nickname 이 비어 있으면 비활성(제출 시 실행). 일치하는 유저가
 * 없으면 data 가 null 이다.
 */
export function useSearchFriend(
  nickname: string,
): UseQueryResult<FriendSearchResult | null, Error> {
  return useQuery({
    queryKey: friendKeys.search(nickname),
    queryFn: () => searchFriend(nickname),
    enabled: nickname.length > 0,
    staleTime: 0,
  });
}
