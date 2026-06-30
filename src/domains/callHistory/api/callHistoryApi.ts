import { httpGet, httpPost } from "@/lib/http";
import type {
  AnalysisQuota,
  AnalysisResult,
  AnalysisStatus,
  CallHistoryList,
  CallTranscript,
} from "../types";

export const fetchCallHistory = (page: number, size: number) =>
  httpGet<CallHistoryList>(`/calls?page=${page}&size=${size}`);

/**
 * 분석 티켓 잔여 조회. 서버가 자정 충전을 푸시하지 않는 lazy 방식이라, 화면 진입·
 * 앱 포그라운드 복귀 시 다시 호출해 갱신한다(useAnalysisQuota).
 */
export const fetchAnalysisQuota = () =>
  httpGet<AnalysisQuota>("/me/analysis-quota");

/**
 * 분석 트리거. BE 가 멱등이라 이미 진행 중/완료된 통화여도 동일한 analysisId 를
 * 반환한다. 응답의 analysisId 가 곧 본인 분석 row 의 식별자 — 이후 폴링과 결과
 * 조회는 이 값을 path param 으로 쓴다.
 */
export const requestAnalysis = (callId: number) =>
  httpPost<{ analysisId: number }>(`/calls/${callId}/analysis`);

/**
 * 분석 상태 폴링용. 결과 화면이 마운트된 동안만 호출된다.
 */
export const fetchAnalysisStatus = (analysisId: number) =>
  httpGet<{ status: AnalysisStatus }>(`/analyses/${analysisId}/status`);

/**
 * 분석 결과 본문 조회. 폴링이 COMPLETED 를 떨군 직후 1회만 호출하면 충분.
 * PROCESSING/FAILED 응답은 mistakes/positives 가 빈 배열로 내려온다.
 */
export const fetchAnalysisResult = (analysisId: number) =>
  httpGet<AnalysisResult>(`/analyses/${analysisId}`);

/**
 * 통화 스크립트 조회. 분석 완료 후 결과 화면에서 "전체 대화 보기" 를 펼칠 때 1회
 * 호출한다. transcript 는 생성되면 변하지 않으므로 폴링하지 않는다. 통화 참여자가
 * 아니거나(403)·통화/transcript 가 없거나(404)·아직 준비 안 됨(409) 인 경우
 * http 레이어가 ApiError(status) 로 던진다.
 */
export const fetchCallTranscript = (callId: number) =>
  httpGet<CallTranscript>(`/calls/${callId}/transcript`);
