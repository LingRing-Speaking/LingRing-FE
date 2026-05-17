import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { deleteBlock } from "../api/blockApi";

export function useUnblockUser(): UseMutationResult<void, Error, number> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteBlock,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blocks"] });
    },
  });
}
