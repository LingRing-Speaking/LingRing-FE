import { useQuery } from "@tanstack/react-query";
import { fetchAnalysisStatus } from "../api/callHistoryApi";
import type { AnalysisStatus } from "../types";

const POLL_INTERVAL_MS = 3000;

/**
 * 결과 화면이 마운트되어 있는 동안 분석 상태를 3 초마다 폴링한다.
 * COMPLETED 또는 FAILED 가 떨어지면 그 자리에서 멈춘다.
 *
 * @param enabled - false 이면 쿼리를 아예 실행하지 않는다.
 *                  무효한 analysisId 로 불필요한 요청이 나가는 것을 방지.
 */
export function usePollAnalysisStatus(
  analysisId: number,
  { enabled = true }: { enabled?: boolean } = {},
) {
  return useQuery<{ status: AnalysisStatus }>({
    queryKey: ["analysisStatus", analysisId],
    queryFn: () => fetchAnalysisStatus(analysisId),
    enabled,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "COMPLETED" || status === "FAILED"
        ? false
        : POLL_INTERVAL_MS;
    },
  });
}
