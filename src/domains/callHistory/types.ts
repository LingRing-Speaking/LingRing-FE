export type CallPartner = {
  id: number;
  name: string;
  profileImage: string | null;
};

/**
 * 통화 분석 상태. 카드 버튼은 이 값 하나로 4상태 분기한다.
 * - READY: 본인이 아직 요청 안 함 → "분석하기"
 * - PROCESSING: 서버 분석 진행 중 → "분석중" (비활성)
 * - COMPLETED: 분석 완료 → "분석 완료" (결과 페이지 진입)
 * - FAILED: 분석 실패 → "재분석"
 */
export type AnalysisStatus = "READY" | "PROCESSING" | "COMPLETED" | "FAILED";

/**
 * 통화 카드 항목.
 * - `analysisStatus === "READY"` 일 때만 `analysisId` 가 null.
 * - 그 외 상태(PROCESSING/COMPLETED/FAILED)에서는 `analysisId` 가 number.
 */
export type CallHistoryItem = {
  id: number;
  /**
   * 통화 상대 정보. 상대가 탈퇴해 BE 에서 user row 가 사라진 경우 null.
   * UI 에서는 "알 수 없음" 으로 표시하고 프로필 모달 진입은 비활성화한다.
   */
  partner: CallPartner | null;
  startedAt: string; // ISO 8601 (예: "2026-04-29T19:30:00+09:00")
  durationSec: number;
  analysisId: number | null;
  analysisStatus: AnalysisStatus;
};

export type CallHistoryList = {
  items: CallHistoryItem[];
  hasNext: boolean;
};

/**
 * 실수 카테고리. BE 에서 새 값이 추가될 가능성을 고려해 unknown 은 OTHER 폴백.
 */
export type FeedbackTag =
  | "GRAMMAR"
  | "VOCABULARY"
  | "COLLOCATION"
  | "TONE"
  | "OTHER";

export type MistakeItem = {
  tag: FeedbackTag;
  wrong: string;
  improved: string;
  reason: string;
  koMeaning: string;
};

export type PositiveItem = {
  sentence: string;
  goodPart: string;
  koMeaning: string;
};

/**
 * `GET /analyses/{analysisId}` 응답. PROCESSING/FAILED 일 때 mistakes/positives
 * 는 빈 배열, modelIdentifier 는 null 로 내려온다.
 */
export type AnalysisResult = {
  callId: number;
  userId: number;
  status: AnalysisStatus;
  modelIdentifier: string | null;
  mistakes: MistakeItem[];
  positives: PositiveItem[];
};
