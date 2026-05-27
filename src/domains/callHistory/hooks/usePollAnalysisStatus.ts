import { useQuery } from "@tanstack/react-query";
import { fetchAnalysisStatus } from "../api/callHistoryApi";
import type { AnalysisStatus } from "../types";

const POLL_INTERVAL_MS = 3000;

/**
 * 결과 화면이 마운트되어 있는 동안 분석 상태를 3 초마다 폴링한다.
 * COMPLETED 또는 FAILED 가 떨어지면 그 자리에서 멈춘다.
 */
export function usePollAnalysisStatus(analysisId: number) {
  return useQuery<{ status: AnalysisStatus }>({
    queryKey: ["analysisStatus", analysisId],
    queryFn: () => fetchAnalysisStatus(analysisId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "COMPLETED" || status === "FAILED"
        ? false
        : POLL_INTERVAL_MS;
    },
  });
}
