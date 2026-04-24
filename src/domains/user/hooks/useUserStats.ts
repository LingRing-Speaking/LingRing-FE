import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { fetchUserStats } from "../api/userApi";
import type { UserStats } from "../types";

export function useUserStats(userId: number): UseQueryResult<UserStats, Error> {
  return useQuery({
    queryKey: ["user", userId, "stats"],
    queryFn: () => fetchUserStats(userId),
  });
}
