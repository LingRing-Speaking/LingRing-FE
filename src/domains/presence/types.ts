import type { IncomingInvitation } from "@/domains/matching/types";

// POST /me/presence 하트비트 응답 (#213 부터 Void → 확장).
// 수신 통화 초대가 별도 폴링 없이 하트비트에 piggyback 되어 도착한다.
export type HeartbeatResponse = {
  incomingInvitation: IncomingInvitation | null;
};
