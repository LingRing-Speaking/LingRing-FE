export type CallPartner = {
  id: number;
  name: string;
  profileImage: string | null;
};

export type CallHistoryItem = {
  id: number;
  /**
   * 통화 상대 정보. 상대가 탈퇴해 BE 에서 user row 가 사라진 경우 null.
   * UI 에서는 "알 수 없음" 으로 표시하고 프로필 모달 진입은 비활성화한다.
   */
  partner: CallPartner | null;
  startedAt: string; // ISO 8601 (예: "2026-04-29T19:30:00+09:00")
  durationSec: number;
  analyzed: boolean;
};

export type CallHistoryList = {
  items: CallHistoryItem[];
  hasNext: boolean;
};
