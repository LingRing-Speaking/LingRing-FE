import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { submitReport } from "../api/reportApi";
import type { ReportInput } from "../types";

export function useSubmitReport(): UseMutationResult<void, Error, ReportInput> {
  return useMutation({
    mutationFn: submitReport,
  });
}
