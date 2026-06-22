import { useQuery } from "@tanstack/react-query";
import type { ApiError } from "@/lib/http";
import { fetchCallTranscript } from "../api/callHistoryApi";
import type { CallTranscript } from "../types";

/**
 * 통화 스크립트 조회. "전체 대화 보기" 를 펼친 동안에만 enabled 로 켜서 lazy 하게
 * 호출한다 — 첫 펼침에만 fetch 되고 이후엔 캐시에서 읽는다. transcript 는 생성 후
 * 변하지 않으므로 폴링하지 않는다. 에러는 ApiError 로 잡혀 호출부에서 status 로
 * 분기할 수 있다.
 */
export function useCallTranscript(callId: number, enabled: boolean) {
  return useQuery<CallTranscript, ApiError>({
    queryKey: ["callTranscript", callId],
    queryFn: () => fetchCallTranscript(callId),
    enabled,
  });
}
