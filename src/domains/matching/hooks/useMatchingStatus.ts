import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { fetchMatchingStatus } from "../api/matchingApi";
import type { MatchingStatus } from "../types";

const WAITING_INTERVAL_MS = 3000;
const AWAITING_CONFIRM_INTERVAL_MS = 1000;

export function useMatchingStatus(
  enabled: boolean,
): UseQueryResult<MatchingStatus, Error> {
  return useQuery({
    queryKey: ["matching", "status"],
    queryFn: fetchMatchingStatus,
    enabled,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === "MATCHED") return false;
      if (status === "AWAITING_CONFIRM") return AWAITING_CONFIRM_INTERVAL_MS;
      return WAITING_INTERVAL_MS;
    },
    refetchOnMount: "always",
    gcTime: 0,
    staleTime: 0,
  });
}
