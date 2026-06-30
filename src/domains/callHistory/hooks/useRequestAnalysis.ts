import {
  useMutation,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { requestAnalysis } from "../api/callHistoryApi";
import type { CallHistoryList } from "../types";
import { ANALYSIS_QUOTA_QUERY_KEY } from "./useAnalysisQuota";

const CALLS_QUERY_KEY = ["calls"] as const;

/**
 * 통화 분석을 트리거하고 본인 analysisId 를 받는다. 응답이 떨어지면 `["calls"]`
 * 캐시의 해당 카드를 analysisId + PROCESSING 으로 즉시 갱신해, 사용자가 카드에
 * 머무른 채로 "분석중" 라벨을 바로 보게 한다. 이후 실제 완료 여부는 목록
 * 폴링(usePollTransientCalls)이 따라가며 갱신한다.
 *
 * 최초 분석 요청은 티켓 1장을 차감하므로(서버 수행) 성공·실패와 무관하게
 * onSettled 에서 `["analysisQuota"]` 를 invalidate 해, 배지의 잔여 티켓을
 * 서버 기준으로 다시 맞춘다(차감 반영, 403 소진 시 0 동기화).
 */
export function useRequestAnalysis() {
  const queryClient = useQueryClient();

  return useMutation<{ analysisId: number }, Error, number>({
    mutationFn: (callId) => requestAnalysis(callId),

    onSuccess: ({ analysisId }, callId) => {
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
                  ? { ...item, analysisId, analysisStatus: "PROCESSING" as const }
                  : item,
              ),
            })),
          };
        },
      );
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ANALYSIS_QUOTA_QUERY_KEY });
    },
  });
}
