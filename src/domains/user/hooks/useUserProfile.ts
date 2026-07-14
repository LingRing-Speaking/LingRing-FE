import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { fetchUserProfile } from "../api/userApi";
import { userKeys } from "../queryKeys";
import type { UserProfile } from "../types";

export function useUserProfile(
  userId: number | null,
): UseQueryResult<UserProfile, Error> {
  return useQuery({
    queryKey: userKeys.profile(userId as number),
    queryFn: () => fetchUserProfile(userId as number),
    enabled: userId != null,
  });
}
