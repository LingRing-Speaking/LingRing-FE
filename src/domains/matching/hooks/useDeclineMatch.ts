import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { declineMatch } from "../api/matchAccept";

export function useDeclineMatch(): UseMutationResult<void, Error, void> {
  return useMutation({
    mutationFn: declineMatch,
  });
}
