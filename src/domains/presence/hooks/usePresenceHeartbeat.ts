import { useEffect } from "react";
import { App } from "@capacitor/app";
import type { PluginListenerHandle } from "@capacitor/core";
import { useAuthStore } from "@/domains/auth/store";
import { useIncomingInvitationStore } from "@/domains/matching/incomingInvitationStore";
import type { IncomingInvitation } from "@/domains/matching/types";
import { goOffline, sendHeartbeat } from "../api/presenceApi";

const HEARTBEAT_INTERVAL_MS = 5000;

/**
 * 포그라운드 동안 5초 주기로 하트비트를 보내 온라인 TTL(서버 10초)을 갱신한다.
 * 특정 화면이 아니라 앱 전역 라이프사이클에 묶어(로그인~로그아웃, 포그라운드~백그라운드)
 * 어느 화면에 있든 온라인으로 유지되게 한다. App 최상단에서 한 번만 마운트한다.
 */
export function usePresenceHeartbeat(): void {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated) return;

    let intervalId: number | null = null;

    const setInvitation = (invitation: IncomingInvitation | null) =>
      useIncomingInvitationStore.getState().setInvitation(invitation);

    const startHeartbeat = () => {
      if (intervalId !== null) return; // appStateChange 가 연달아 와도 interval 중복 생성 방지
      // 네트워크 오류는 무시하고 다음 tick 에 재시도한다(TTL 2배 마진이 1회 유실을 흡수).
      // 401 은 http 레이어가 토큰 갱신을 시도하고, 갱신이 거부되면 세션이 정리되어
      // isAuthenticated 가 false 로 바뀌며 이 effect 의 cleanup 이 루프를 멈춘다.
      // 응답의 incomingInvitation(수신 통화 초대 #213)은 전역 스토어로 흘려보낸다 —
      // 배포 전환기에 응답 바디가 없을 수 있어(?.) 방어한다.
      const ping = () =>
        void sendHeartbeat()
          .then((res) => setInvitation(res?.incomingInvitation ?? null))
          .catch(() => {});
      ping();
      intervalId = window.setInterval(ping, HEARTBEAT_INTERVAL_MS);
    };

    const stopHeartbeat = () => {
      if (intervalId === null) return;
      window.clearInterval(intervalId);
      intervalId = null;
      // 하트비트가 멈추면(백그라운드·로그아웃) 벨을 받을 수 없다 — 남은 수신 초대를 비워
      // 복귀 시 stale 벨이 잠깐 보이는 것을 막는다. 유효한 초대면 다음 하트비트가 다시 내려준다.
      setInvitation(null);
    };

    startHeartbeat();

    // 백그라운드로 가면 하트비트를 멈추고 즉시 오프라인을 알린다. 포그라운드로 돌아오면 재개.
    let removed = false;
    let handle: PluginListenerHandle | null = null;
    void App.addListener("appStateChange", ({ isActive }) => {
      if (isActive) {
        startHeartbeat();
      } else {
        stopHeartbeat();
        void goOffline().catch(() => {});
      }
    }).then((registered) => {
      if (removed) void registered.remove();
      else handle = registered;
    });

    return () => {
      removed = true;
      stopHeartbeat();
      void handle?.remove();
    };
  }, [isAuthenticated]);
}
