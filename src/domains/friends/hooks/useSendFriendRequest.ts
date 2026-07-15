import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { userKeys } from "@/domains/user/queryKeys";
import { sendFriendRequest } from "../api/friendApi";
import { friendKeys } from "../queryKeys";
import type { SendFriendRequestResult } from "../types";

/**
 * 친구 요청 보내기. 응답 status 가 PENDING(요청 보냄) 또는 ACCEPTED(상대가 이미 나에게
 * 보냈던 경우 즉시 친구)로 온다. 성공 시 무효화로 검색 결과·프로필 모달의 relation 이
 * 갱신된다. 검색·통화중·통화 기록 프로필 모달이 모두 이 훅을 쓴다.
 */
export function useSendFriendRequest(): UseMutationResult<SendFriendRequestResult, Error, number> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (targetUserId: number) => sendFriendRequest(targetUserId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: friendKeys.all });
      void queryClient.invalidateQueries({ queryKey: userKeys.all });
    },
  });
}
