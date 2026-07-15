import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { fetchOutgoingInvitation } from "../api/callInvitationApi";
import type { OutgoingInvitation } from "../types";

// 초대 TTL 이 30초로 짧아 전화벨 UX 에 맞춰 1초 폴링한다 (BE 설계 #213).
const RINGING_POLL_INTERVAL_MS = 1000;

export function useOutgoingInvitation(
  enabled: boolean,
): UseQueryResult<OutgoingInvitation, Error> {
  return useQuery({
    queryKey: ["callInvitation", "outgoing"],
    queryFn: fetchOutgoingInvitation,
    enabled,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      // ACCEPTED/DECLINED/NONE 은 종결 상태 — 폴링 중단.
      if (status === undefined || status === "RINGING") return RINGING_POLL_INTERVAL_MS;
      return false;
    },
    refetchOnMount: "always",
    gcTime: 0,
    staleTime: 0,
  });
}
