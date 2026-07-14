import { httpDelete, httpGet, httpPost } from "@/lib/http";
import type { CallInvitationAcceptResult, OutgoingInvitation } from "../types";

const INVITATION_PATH = "/call-invitations";
const OUTGOING_PATH = `${INVITATION_PATH}/outgoing`;

// 친구에게 통화 초대 발신. 친구 아님 404, 수신자 오프라인·수신 슬롯 점유·본인 발신 중 409.
export const createCallInvitation = (inviteeUserId: number): Promise<void> =>
  httpPost(INVITATION_PATH, { inviteeUserId });

// 발신자 상태 폴링. RINGING / ACCEPTED / DECLINED / NONE.
export const fetchOutgoingInvitation = (): Promise<OutgoingInvitation> =>
  httpGet<OutgoingInvitation>(OUTGOING_PATH);

// 발신 취소. 멱등 204 — 초대가 이미 소멸했어도 성공 처리.
export const cancelOutgoingInvitation = (): Promise<void> => httpDelete(OUTGOING_PATH);

// 수신 초대 수락 — 이 순간 BE 가 Call 을 생성한다. 초대가 이미 소멸(만료·취소)했으면 404.
export const acceptCallInvitation = (): Promise<CallInvitationAcceptResult> =>
  httpPost<CallInvitationAcceptResult>(`${INVITATION_PATH}/accept`);

// 수신 초대 거절. 초대가 이미 소멸했으면 404.
export const declineCallInvitation = (): Promise<void> =>
  httpPost(`${INVITATION_PATH}/decline`);
