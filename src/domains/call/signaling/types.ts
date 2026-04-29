export type SdpPayload = { sdp: string };

export type IceCandidatePayload = {
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number | null;
};

export type ReadyPayload = {
  callerUserId: number;
  calleeUserId: number;
};

export type ErrorPayload = {
  code: string;
  message: string;
};

export type ClientMessage =
  | { type: "JOIN" }
  | { type: "OFFER"; payload: SdpPayload }
  | { type: "ANSWER"; payload: SdpPayload }
  | { type: "ICE_CANDIDATE"; payload: IceCandidatePayload }
  | { type: "HANGUP" };

export type ServerMessage =
  | {
      type: "READY";
      fromUserId: number;
      toUserId: number;
      payload: ReadyPayload;
    }
  | {
      type: "OFFER" | "ANSWER";
      fromUserId: number;
      toUserId: number;
      payload: SdpPayload;
    }
  | {
      type: "ICE_CANDIDATE";
      fromUserId: number;
      toUserId: number;
      payload: IceCandidatePayload;
    }
  | {
      type: "HANGUP";
      fromUserId: number | null;
      toUserId: number | null;
      payload: null;
    }
  | { type: "ERROR"; payload: ErrorPayload };
