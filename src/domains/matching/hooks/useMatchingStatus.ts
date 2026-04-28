import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { fetchMatchingStatus } from "../api/matchingApi";
import type { MatchingStatus } from "../types";

const POLL_INTERVAL_MS = 3000;

export function useMatchingStatus(
  userId: number,
  enabled: boolean,
): UseQueryResult<MatchingStatus, Error> {
  return useQuery({
    queryKey: ["matching", "status", userId],
    queryFn: () => fetchMatchingStatus(userId),
    enabled,
    refetchInterval: (query) =>
      query.state.data?.status === "MATCHED" ? false : POLL_INTERVAL_MS,
    refetchOnMount: "always",
    gcTime: 0,
    staleTime: 0,
  });
}
