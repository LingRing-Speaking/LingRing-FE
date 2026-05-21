import { httpGet, httpPost } from "@/lib/http";
import type { AnalysisStatus, CallHistoryList } from "../types";

export const fetchCallHistory = (page: number, size: number) =>
  httpGet<CallHistoryList>(`/calls?page=${page}&size=${size}`);

export type AnalysisStatusResponse = {
  analysisStatus: AnalysisStatus;
};

// BE 의 분석 트리거 응답. 멱등이라 이미 처리 중이면 PROCESSING, 이미 완료된
// 통화면 COMPLETED 가 그대로 반환된다. (CallTranscriptApi#requestAnalysis)
type TriggerAnalysisBeStatus = "PROCESSING" | "COMPLETED";
type TriggerAnalysisBeResponse = { status: TriggerAnalysisBeStatus };

const FE_STATUS_BY_BE: Record<TriggerAnalysisBeStatus, AnalysisStatus> = {
  PROCESSING: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
};

export const requestAnalysis = async (
  callId: number,
): Promise<AnalysisStatusResponse> => {
  const { status } = await httpPost<TriggerAnalysisBeResponse>(
    `/calls/${callId}/analysis`,
  );
  return { analysisStatus: FE_STATUS_BY_BE[status] };
};

// 분석 결과 본문(result) 은 결과 페이지 작업(별도 이슈)에서 타입을 구체화한다.
// 이번 PR 에서는 status 만 소비하므로 result 는 unknown 으로 둔다.
export type CallAnalysisResponse = {
  analysisStatus: AnalysisStatus;
  result: unknown;
};

export const fetchCallAnalysisStatus = (callId: number) =>
  httpGet<CallAnalysisResponse>(`/calls/${callId}/analysis`);
