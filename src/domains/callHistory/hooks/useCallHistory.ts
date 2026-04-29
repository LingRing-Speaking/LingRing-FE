import {
  useInfiniteQuery,
  type InfiniteData,
  type UseInfiniteQueryResult,
} from "@tanstack/react-query";
import { fetchCallHistory } from "../api/callHistoryApi";
import type { CallHistoryList } from "../types";

const PAGE_SIZE = 20;

export function useCallHistory(
  userId: number,
): UseInfiniteQueryResult<InfiniteData<CallHistoryList, number>, Error> {
  return useInfiniteQuery({
    queryKey: ["callHistory", userId, "list"],
    queryFn: ({ pageParam }) => fetchCallHistory(userId, pageParam, PAGE_SIZE),
    initialPageParam: 0,
    getNextPageParam: (lastPage, _allPages, lastPageParam) =>
      lastPage.hasNext ? lastPageParam + 1 : undefined,
  });
}
