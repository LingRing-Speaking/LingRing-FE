import { useEffect } from "react";
import {
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import { fetchAnalysisQuota } from "../api/callHistoryApi";
import type { AnalysisQuota } from "../types";

export const ANALYSIS_QUOTA_QUERY_KEY = ["analysisQuota"] as const;

/**
 * 분석 티켓 잔여를 조회한다. 서버는 자정 충전을 즉시 푸시하지 않고 조회 시점에
 * lazy 로 채우므로, 항상 최신 잔여를 보여주기 위해:
 * - 화면 진입 시: staleTime 0 → 마운트마다 refetch.
 * - 앱 포그라운드 복귀 시: visibilitychange(visible) → invalidate 후 refetch.
 * (전역 refetchOnWindowFocus 는 꺼져 있어, 이 훅이 자체적으로 갱신을 책임진다.)
 */
export function useAnalysisQuota(): UseQueryResult<AnalysisQuota, Error> {
  const queryClient = useQueryClient();

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void queryClient.invalidateQueries({
          queryKey: ANALYSIS_QUOTA_QUERY_KEY,
        });
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [queryClient]);

  return useQuery({
    queryKey: ANALYSIS_QUOTA_QUERY_KEY,
    queryFn: fetchAnalysisQuota,
    staleTime: 0,
  });
}
