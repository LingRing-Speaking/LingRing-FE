import { useEffect } from "react";
import { useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { fetchReceivedCount } from "../api/friendApi";
import { friendKeys } from "../queryKeys";

/**
 * 받은 친구 요청 개수. 탭 바·요청 카드 뱃지에 쓴다. 새 요청은 서버가 즉시 푸시하지
 * 않으므로(이번 범위에서 푸시 제외), 화면 진입(staleTime 0)과 앱 포그라운드 복귀
 * (visibilitychange) 시 갱신한다. useAnalysisQuota 와 동일한 lazy 갱신 패턴.
 */
export function useReceivedCount(): UseQueryResult<{ count: number }, Error> {
  const queryClient = useQueryClient();

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void queryClient.invalidateQueries({
          queryKey: friendKeys.receivedCount,
        });
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [queryClient]);

  return useQuery({
    queryKey: friendKeys.receivedCount,
    queryFn: fetchReceivedCount,
    staleTime: 0,
  });
}
