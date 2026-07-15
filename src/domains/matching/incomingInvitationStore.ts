import { create } from "zustand";
import type { IncomingInvitation } from "./types";

interface IncomingInvitationState {
  invitation: IncomingInvitation | null;
  setInvitation: (invitation: IncomingInvitation | null) => void;
}

// 수신 통화 초대(#213)는 폴링 쿼리가 아니라 presence 하트비트 응답에 piggyback 되어
// 도착하므로 TanStack Query 캐시가 아닌 전역 스토어로 전달한다.
// 쓰기: usePresenceHeartbeat, 읽기: IncomingInvitationBanner.
export const useIncomingInvitationStore = create<IncomingInvitationState>((set) => ({
  invitation: null,
  setInvitation: (next) =>
    set((state) => {
      // 하트비트가 5초마다 같은 초대를 다시 내려줘도 내용이 같으면 참조를 유지해
      // 구독 컴포넌트의 불필요한 재렌더를 막는다.
      const isSameContent =
        state.invitation?.inviterId === next?.inviterId &&
        state.invitation?.deadline === next?.deadline;
      return isSameContent ? state : { invitation: next };
    }),
}));
