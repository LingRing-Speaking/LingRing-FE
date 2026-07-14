import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { userKeys } from "@/domains/user/queryKeys";
import { removeRelation } from "../api/friendApi";
import { friendKeys } from "../queryKeys";

/**
 * 관계 제거 공용 mutation — 친구 삭제 · 받은 요청 거절 · 보낸 요청 취소가 모두 이 훅을
 * 쓴다(서버는 DELETE /friends/{id} 하나로 처리). 성공 시 친구 목록·요청·개수·검색·
 * 프로필(relation)을 한 번에 무효화한다.
 */
export function useRemoveRelation(): UseMutationResult<void, Error, number> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: number) => removeRelation(userId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: friendKeys.all });
      void queryClient.invalidateQueries({ queryKey: userKeys.all });
    },
  });
}
