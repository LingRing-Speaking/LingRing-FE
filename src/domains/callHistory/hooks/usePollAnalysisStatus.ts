import {
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import {
  fetchCallAnalysisStatus,
  type CallAnalysisResponse,
} from "../api/callHistoryApi";
import type { CallHistoryList } from "../types";

const POLL_INTERVAL_MS = 5000;
const CALLS_QUERY_KEY = ["calls"] as const;
const callAnalysisStatusKey = (callId: number) =>
  ["callAnalysisStatus", callId] as const;

/**
 * 분석중인 통화의 상태를 일정 주기로 폴링하다 COMPLETED 가 되는 순간
 * `["calls"]` 캐시도 함께 COMPLETED 로 갱신한다(카드 라벨 자동 전환).
 * `enabled=false` 이면 폴링하지 않으므로 IN_PROGRESS 인 카드에서만 켜야 한다.
 */
export function usePollAnalysisStatus(callId: number, enabled: boolean) {
  const queryClient = useQueryClient();

  return useQuery<CallAnalysisResponse>({
    queryKey: callAnalysisStatusKey(callId),
    queryFn: async () => {
      const data = await fetchCallAnalysisStatus(callId);
      if (data.analysisStatus === "COMPLETED") {
        queryClient.setQueryData<InfiniteData<CallHistoryList, number>>(
          CALLS_QUERY_KEY,
          (old) => {
            if (!old) return old;
            return {
              ...old,
              pages: old.pages.map((page) => ({
                ...page,
                items: page.items.map((item) =>
                  item.id === callId
                    ? { ...item, analysisStatus: "COMPLETED" as const }
                    : item,
                ),
              })),
            };
          },
        );
      }
      return data;
    },
    enabled,
    refetchInterval: (query) =>
      query.state.data?.analysisStatus === "COMPLETED"
        ? false
        : POLL_INTERVAL_MS,
  });
}
