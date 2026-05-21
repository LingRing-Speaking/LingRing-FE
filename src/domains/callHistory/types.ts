export type CallPartner = {
  id: number;
  name: string;
  profileImage: string | null;
};

/**
 * 통화 분석 상태.
 * - NONE: 아직 분석 요청 안 함 → 카드에 "분석하기" 노출
 * - IN_PROGRESS: 서버 분석 진행 중 → "분석중" + 비활성
 * - COMPLETED: 분석 완료 → "분석 보기"
 *
 * BE 협의 스펙(`docs/analysis/be-api-spec.md`) 기준으로 FE 가 선반영했다.
 */
export type AnalysisStatus = "NONE" | "IN_PROGRESS" | "COMPLETED";

export type CallHistoryItem = {
  id: number;
  /**
   * 통화 상대 정보. 상대가 탈퇴해 BE 에서 user row 가 사라진 경우 null.
   * UI 에서는 "알 수 없음" 으로 표시하고 프로필 모달 진입은 비활성화한다.
   */
  partner: CallPartner | null;
  startedAt: string; // ISO 8601 (예: "2026-04-29T19:30:00+09:00")
  durationSec: number;
  analysisStatus: AnalysisStatus;
};

export type CallHistoryList = {
  items: CallHistoryItem[];
  hasNext: boolean;
};
