import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { createBlock } from "../api/blockApi";
import type { BlockCreateInput, BlockedUser } from "../types";

export function useBlockUser(): UseMutationResult<BlockedUser, Error, BlockCreateInput> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createBlock,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blocks"] });
    },
  });
}
