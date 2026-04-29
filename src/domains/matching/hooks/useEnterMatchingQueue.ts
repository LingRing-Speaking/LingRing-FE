import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { enterMatchingQueue } from "../api/matchingApi";

export function useEnterMatchingQueue(): UseMutationResult<
  void,
  Error,
  number
> {
  return useMutation({
    mutationFn: (userId: number) => enterMatchingQueue(userId),
  });
}
