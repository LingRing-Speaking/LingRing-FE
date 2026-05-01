import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { fetchMyStats } from "../api/userApi";
import type { UserStats } from "../types";

export function useMyStats(): UseQueryResult<UserStats, Error> {
  return useQuery({
    queryKey: ["me", "stats"],
    queryFn: fetchMyStats,
  });
}
