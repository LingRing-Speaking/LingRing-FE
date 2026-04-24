import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { fetchUserMy } from "../api/userApi";
import type { UserMy } from "../types";

export function useUserMy(userId: number): UseQueryResult<UserMy, Error> {
  return useQuery({
    queryKey: ["user", userId, "my"],
    queryFn: () => fetchUserMy(userId),
  });
}
