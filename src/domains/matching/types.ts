export type MatchStatus = "MATCHED" | "WAITING" | "NONE" | "AWAITING_CONFIRM";

export type MatchingStatus = {
  status: MatchStatus;
  partnerId: number | null;
  roomId: string | null;
  // BE PR #96 — MATCHED 시점에 BE 가 생성한 call entity id.
  // 통화 종료 후 녹음 업로드 endpoint 에서 path variable 로 사용.
  callId: number | null;
  confirmDeadline: string | null;
};
