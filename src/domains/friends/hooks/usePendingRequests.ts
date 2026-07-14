import {
  useInfiniteQuery,
  type InfiniteData,
  type UseInfiniteQueryResult,
} from "@tanstack/react-query";
import { fetchFriends } from "../api/friendApi";
import { friendKeys } from "../queryKeys";
import type { FriendDirection, FriendList } from "../types";

const PAGE_SIZE = 20;

// 대기 요청 목록. 받은(RECEIVED)/보낸(SENT)을 방향별로 독립 페이지네이션한다.
export function usePendingRequests(
  direction: FriendDirection,
): UseInfiniteQueryResult<InfiniteData<FriendList, number>, Error> {
  return useInfiniteQuery({
    queryKey: friendKeys.pending(direction),
    queryFn: ({ pageParam }) =>
      fetchFriends({ status: "PENDING", direction, page: pageParam, size: PAGE_SIZE }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, _allPages, lastPageParam) =>
      lastPage.hasNext ? lastPageParam + 1 : undefined,
  });
}
