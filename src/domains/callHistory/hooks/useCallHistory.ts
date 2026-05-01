import {
  useInfiniteQuery,
  type InfiniteData,
  type UseInfiniteQueryResult,
} from "@tanstack/react-query";
import { fetchCallHistory } from "../api/callHistoryApi";
import type { CallHistoryList } from "../types";

const PAGE_SIZE = 20;

export function useCallHistory(): UseInfiniteQueryResult<
  InfiniteData<CallHistoryList, number>,
  Error
> {
  return useInfiniteQuery({
    queryKey: ["calls"],
    queryFn: ({ pageParam }) => fetchCallHistory(pageParam, PAGE_SIZE),
    initialPageParam: 0,
    getNextPageParam: (lastPage, _allPages, lastPageParam) =>
      lastPage.hasNext ? lastPageParam + 1 : undefined,
  });
}
