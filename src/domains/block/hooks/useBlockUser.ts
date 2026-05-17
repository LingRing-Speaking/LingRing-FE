import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { createBlock } from "../api/blockApi";
import type { Block, BlockCreateInput } from "../types";

export function useBlockUser(): UseMutationResult<Block, Error, BlockCreateInput> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createBlock,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blocks"] });
    },
  });
}
