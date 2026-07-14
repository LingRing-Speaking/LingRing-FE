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

// ===== 친구 지목 통화 초대 (#213) =====

// 발신자가 GET /call-invitations/outgoing 폴링으로 관측하는 초대 상태.
// NONE 은 "초대 없음" — 발신 직후 문맥에서는 30초 무응답 만료(응답 없음)로 해석한다.
export type CallInvitationStatus = "RINGING" | "ACCEPTED" | "DECLINED" | "NONE";

export type OutgoingInvitation = {
  status: CallInvitationStatus;
  // ACCEPTED 일 때만 채워진다. 수락 순간 BE 가 Call 을 생성하므로 즉시 방 입장에 쓴다.
  roomId: string | null;
  callId: number | null;
};

// POST /call-invitations/accept 응답 (수신자 측).
export type CallInvitationAcceptResult = {
  roomId: string;
  callId: number;
};

// presence 하트비트 응답에 piggyback 되어 도착하는 수신 초대.
// 발신자 프로필은 내려오지 않으므로 FE 가 inviterId 로 조회한다.
export type IncomingInvitation = {
  inviterId: number;
  deadline: string;
};
