export type MatchStatus = "MATCHED" | "WAITING" | "NONE" | "AWAITING_CONFIRM";

export type MatchingStatus = {
  status: MatchStatus;
  partnerId: number | null;
  roomId: string | null;
  confirmDeadline: string | null;
};
