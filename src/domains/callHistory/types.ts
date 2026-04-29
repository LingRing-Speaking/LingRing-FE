export type CallHistoryItem = {
  id: number;
  partner: { id: number; name: string };
  startedAt: string; // ISO 8601 (예: "2026-04-29T19:30:00+09:00")
  durationSec: number;
  analyzed: boolean;
};

export type CallHistoryList = {
  items: CallHistoryItem[];
  hasNext: boolean;
};
