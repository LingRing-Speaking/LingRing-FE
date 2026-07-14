import {
  useInfiniteQuery,
  type InfiniteData,
  type UseInfiniteQueryResult,
} from "@tanstack/react-query";
import { fetchFriends } from "../api/friendApi";
import { friendKeys } from "../queryKeys";
import type { FriendList } from "../types";

const PAGE_SIZE = 20;
// 친구 탭이 떠 있는 동안 online 상태를 최신으로 유지하기 위한 폴링 주기.
// 탭을 벗어나면(useFriends 언마운트) 폴링도 자동으로 멈춘다.
const PRESENCE_POLL_INTERVAL_MS = 5000;

// 친구 목록(ACCEPTED) 무한 스크롤. 최근순.
export function useFriends(): UseInfiniteQueryResult<InfiniteData<FriendList, number>, Error> {
  return useInfiniteQuery({
    queryKey: friendKeys.accepted,
    queryFn: ({ pageParam }) =>
      fetchFriends({ status: "ACCEPTED", page: pageParam, size: PAGE_SIZE }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, _allPages, lastPageParam) =>
      lastPage.hasNext ? lastPageParam + 1 : undefined,
    refetchInterval: PRESENCE_POLL_INTERVAL_MS,
  });
}
