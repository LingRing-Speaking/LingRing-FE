import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { acceptFriendRequest } from "../api/friendApi";
import { friendKeys } from "../queryKeys";
import type { SendFriendRequestResult } from "../types";

// 받은 요청 수락. 성공 시 친구 목록·요청·개수·검색을 함께 무효화한다.
export function useAcceptFriendRequest(): UseMutationResult<
  SendFriendRequestResult,
  Error,
  number
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (requesterId: number) => acceptFriendRequest(requesterId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: friendKeys.all });
    },
  });
}
