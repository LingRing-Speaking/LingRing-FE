import {
  useMutation,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { requestAnalysis } from "../api/callHistoryApi";
import type { CallHistoryList } from "../types";

const CALLS_QUERY_KEY = ["calls"] as const;

/**
 * 통화 분석을 트리거하고 본인 analysisId 를 받는다. 응답이 떨어지면 `["calls"]`
 * 캐시의 해당 카드를 analysisId + PROCESSING 으로 즉시 갱신해, 사용자가 카드에
 * 머무른 채로 "분석중" 라벨을 바로 보게 한다. 이후 실제 완료 여부는 목록
 * 폴링(usePollTransientCalls)이 따라가며 갱신한다.
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
  });
}
