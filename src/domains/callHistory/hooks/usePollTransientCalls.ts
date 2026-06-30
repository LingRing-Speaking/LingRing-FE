import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { CallHistoryItem } from "../types";

const POLL_INTERVAL_MS = 3000;
const CALLS_QUERY_KEY = ["calls"] as const;

/**
 * 목록 안에 서버가 곧 갱신할 진행 상태(WAITING_RECORDINGS·PROCESSING) 카드가
 * 하나라도 있으면 일정 주기로 `["calls"]` 를 invalidate 해서 최신 analysisStatus
 * 를 반영한다. 녹음 업로드가 끝나면 WAITING_RECORDINGS→READY, 분석이 끝나면
 * PROCESSING→COMPLETED/FAILED 로 전환된다. 모두 종료 상태가 되면 폴링도 멈춘다.
 */
export function usePollTransientCalls(items: CallHistoryItem[]) {
  const queryClient = useQueryClient();
  const hasTransient = items.some(
    (i) =>
      i.analysisStatus === "WAITING_RECORDINGS" ||
      i.analysisStatus === "PROCESSING",
  );

  useEffect(() => {
    if (!hasTransient) return;
    const intervalId = window.setInterval(() => {
      void queryClient.invalidateQueries({ queryKey: CALLS_QUERY_KEY });
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [hasTransient, queryClient]);
}
