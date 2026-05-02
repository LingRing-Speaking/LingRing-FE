import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { fetchUserProfile } from "../api/userApi";
import type { UserProfile } from "../types";

export function useUserProfile(
  userId: number | null,
): UseQueryResult<UserProfile, Error> {
  return useQuery({
    queryKey: ["users", userId],
    queryFn: () => fetchUserProfile(userId as number),
    enabled: userId != null,
  });
}
