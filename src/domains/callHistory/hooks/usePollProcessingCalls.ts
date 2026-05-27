import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { CallHistoryItem } from "../types";

const POLL_INTERVAL_MS = 3000;
const CALLS_QUERY_KEY = ["calls"] as const;

/**
 * 목록 안에 PROCESSING 카드가 하나라도 있으면 일정 주기로 `["calls"]` 를
 * invalidate 해서 BE 의 최신 analysisStatus(COMPLETED/FAILED) 를 반영한다.
 * 모두 종료 상태가 되면 폴링도 자연스럽게 멈춘다.
 */
export function usePollProcessingCalls(items: CallHistoryItem[]) {
  const queryClient = useQueryClient();
  const hasProcessing = items.some((i) => i.analysisStatus === "PROCESSING");

  useEffect(() => {
    if (!hasProcessing) return;
    const intervalId = window.setInterval(() => {
      void queryClient.invalidateQueries({ queryKey: CALLS_QUERY_KEY });
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [hasProcessing, queryClient]);
}
