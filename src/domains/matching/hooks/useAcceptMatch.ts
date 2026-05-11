import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { acceptMatch } from "../api/matchAccept";

export function useAcceptMatch(): UseMutationResult<void, Error, void> {
  return useMutation({
    mutationFn: acceptMatch,
  });
}
