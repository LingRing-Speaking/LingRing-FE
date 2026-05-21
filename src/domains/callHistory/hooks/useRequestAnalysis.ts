import {
  useMutation,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import {
  requestAnalysis,
  type AnalysisStatusResponse,
} from "../api/callHistoryApi";
import type { CallHistoryList } from "../types";

const CALLS_QUERY_KEY = ["calls"] as const;

type RollbackContext = {
  previousCalls: InfiniteData<CallHistoryList, number> | undefined;
};

/**
 * 통화 분석 트리거. 호출 즉시 `["calls"]` 캐시의 해당 카드를 IN_PROGRESS 로
 * 갱신(optimistic)해 사용자가 분석중 상태를 바로 본다. 서버 응답 실패 시 이전
 * 캐시로 롤백한다. 폴링은 별도 훅(`usePollAnalysisStatus`)이 담당한다.
 */
export function useRequestAnalysis() {
  const queryClient = useQueryClient();

  return useMutation<
    AnalysisStatusResponse,
    Error,
    number,
    RollbackContext
  >({
    mutationFn: (callId) => requestAnalysis(callId),

    onMutate: async (callId) => {
      await queryClient.cancelQueries({ queryKey: CALLS_QUERY_KEY });
      const previousCalls =
        queryClient.getQueryData<InfiniteData<CallHistoryList, number>>(
          CALLS_QUERY_KEY,
        );

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
                  ? { ...item, analysisStatus: "IN_PROGRESS" as const }
                  : item,
              ),
            })),
          };
        },
      );

      return { previousCalls };
    },

    onError: (_error, _callId, context) => {
      if (context?.previousCalls) {
        queryClient.setQueryData(CALLS_QUERY_KEY, context.previousCalls);
      }
    },
  });
}
