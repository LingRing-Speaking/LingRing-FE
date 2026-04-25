import {
  useInfiniteQuery,
  type InfiniteData,
  type UseInfiniteQueryResult,
} from "@tanstack/react-query";
import { fetchUserExpressions } from "../api/userExpressionApi";
import type { UserExpressionList } from "../types";

const PAGE_SIZE = 20;

export function useUserExpressions(
  userId: number,
): UseInfiniteQueryResult<InfiniteData<UserExpressionList, number>, Error> {
  return useInfiniteQuery({
    queryKey: ["userExpression", userId, "list"],
    queryFn: ({ pageParam }) => fetchUserExpressions(userId, pageParam, PAGE_SIZE),
    initialPageParam: 0,
    getNextPageParam: (lastPage, _allPages, lastPageParam) =>
      lastPage.hasNext ? lastPageParam + 1 : undefined,
  });
}
