import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { createCallInvitation } from "../api/callInvitationApi";

// 친구 지목 통화 초대 발신 (#213). variables = inviteeUserId.
export function useCreateCallInvitation(): UseMutationResult<void, Error, number> {
  return useMutation({
    mutationFn: createCallInvitation,
  });
}
