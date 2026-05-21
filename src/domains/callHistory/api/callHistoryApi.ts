import { httpGet, httpPost } from "@/lib/http";
import type { AnalysisStatus, CallHistoryList } from "../types";

export const fetchCallHistory = (page: number, size: number) =>
  httpGet<CallHistoryList>(`/calls?page=${page}&size=${size}`);

export type AnalysisStatusResponse = {
  analysisStatus: AnalysisStatus;
};

export const requestAnalysis = (callId: number) =>
  httpPost<AnalysisStatusResponse>(`/calls/${callId}/analyze`);

// 분석 결과 본문(result) 은 결과 페이지 작업(별도 이슈)에서 타입을 구체화한다.
// 이번 PR 에서는 status 만 소비하므로 result 는 unknown 으로 둔다.
export type CallAnalysisResponse = {
  analysisStatus: AnalysisStatus;
  result: unknown;
};

export const fetchCallAnalysisStatus = (callId: number) =>
  httpGet<CallAnalysisResponse>(`/calls/${callId}/analysis`);
