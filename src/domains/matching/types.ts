export type MatchStatus = "MATCHED" | "WAITING" | "NONE";

export type MatchingStatus = {
  status: MatchStatus;
  partnerId: number | null;
};
