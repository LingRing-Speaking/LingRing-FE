import { useQuery } from "@tanstack/react-query";
import { fetchAnalysisResult } from "../api/callHistoryApi";
import type { AnalysisResult } from "../types";

/**
 * 분석 결과 본문. 폴링이 COMPLETED 를 떨군 시점에만 enabled 로 켜서 호출한다 —
 * PROCESSING/FAILED 동안 본문을 받아봐야 mistakes/positives 가 빈 배열이라 의미
 * 없음.
 */
export function useAnalysisResult(analysisId: number, enabled: boolean) {
  return useQuery<AnalysisResult>({
    queryKey: ["analysisResult", analysisId],
    queryFn: () => fetchAnalysisResult(analysisId),
    enabled,
  });
}
