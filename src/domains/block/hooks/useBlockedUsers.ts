import {
  useInfiniteQuery,
  type InfiniteData,
  type UseInfiniteQueryResult,
} from "@tanstack/react-query";
import { fetchBlockedUsers } from "../api/blockApi";
import type { BlockListResponse } from "../types";

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
