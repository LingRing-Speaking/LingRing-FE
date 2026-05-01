import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { enterMatchingQueue } from "../api/matchingApi";

export function useEnterMatchingQueue(): UseMutationResult<void, Error, void> {
  return useMutation({
    mutationFn: enterMatchingQueue,
  });
}
