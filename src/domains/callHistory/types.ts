export type CallPartner = {
  id: number;
  name: string;
  profileImage: string | null;
};

/**
 * 통화 분석 상태. 카드 버튼은 이 값 하나로 분기한다.
 * - WAITING_RECORDINGS: 녹음 업로드 중(두 화자 중 아직 덜 올라옴) → "대기중" (비활성)
 * - READY: 녹음 완료·분석 미요청 → "분석하기"
 * - PROCESSING: 서버 분석 진행 중 → "분석중" (비활성)
 * - COMPLETED: 분석 완료 → "분석보기" (결과 페이지 진입)
 * - FAILED: 분석 실패 → "재분석"
 */
export type AnalysisStatus =
  | "WAITING_RECORDINGS"
  | "READY"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED";

/**
 * 통화 카드 항목.
 * - 분석 row 가 생기기 전(WAITING_RECORDINGS/READY)에는 `analysisId` 가 null.
 * - 분석을 요청한 뒤(PROCESSING/COMPLETED/FAILED)에는 `analysisId` 가 number.
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
 * 분석 티켓 잔여. 분석 1회당 티켓 1장이 차감되며, 일반티켓을 먼저 쓰고 없으면
 * 황금티켓이 차감된다(차감은 서버가 수행).
 * - freeTicket: 매일 0시(KST)에 다시 차는 무료 "일반티켓".
 * - paidTicket: 지급·구매된 "황금티켓".
 * - nextResetAt: 일반티켓이 다시 차는 다음 0시. 오프셋 없는 LocalDateTime 이라
 *   KST(Asia/Seoul)로 해석한다. 현재 UI 는 "매일 0시 충전" 안내만 하고 이 값을
 *   직접 표시하진 않으나, 계약 충실성을 위해 받는다.
 */
export type AnalysisQuota = {
  freeTicket: number;
  paidTicket: number;
  nextResetAt: string;
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

/**
 * 통화 스크립트(STT) 한 발화. 화자는 원시 userId 로만 내려오므로, 화면에서는
 * 본인의 인증된 userId 와 비교해 나/상대를 가른다. `endSec` 은 계약 충실성을 위해
 * 받기만 하고 현재 UI 에서는 사용하지 않는다.
 */
export type TranscriptSegment = {
  userId: number;
  startSec: number;
  endSec: number;
  text: string;
};

/**
 * `GET /calls/{callId}/transcript` 응답. 통화당 1개이며 두 참여자가 공유한다.
 * `segments` 는 서버가 `startSec` 오름차순으로 정렬해 내려준다.
 */
export type CallTranscript = {
  callId: number;
  segments: TranscriptSegment[];
};
