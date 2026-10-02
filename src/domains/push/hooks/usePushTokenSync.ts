import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import type { PluginListenerHandle } from "@capacitor/core";
import { FirebaseMessaging } from "@capacitor-firebase/messaging";
import { useAuthStore } from "@/domains/auth/store";
import { handleTokenRefresh, syncPushToken } from "../pushToken";

/**
 * 로그인 상태 동안 FCM 토큰을 BE 에 등록해 둔다. 앱 시작(세션 복원)·로그인 직후 1회 등록하고,
 * FCM 이 토큰을 새로 발급하면 다시 등록한다. App 최상단에서 한 번만 마운트한다.
 * 등록 실패는 무시한다 — 다음 앱 실행 때 다시 시도된다.
 */
export function usePushTokenSync(): void {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated || !Capacitor.isNativePlatform()) return;

    void syncPushToken().catch(() => {});

    let removed = false;
    let handle: PluginListenerHandle | null = null;
    void FirebaseMessaging.addListener("tokenReceived", ({ token }) => {
      void handleTokenRefresh(token).catch(() => {});
    }).then((registered) => {
      if (removed) void registered.remove();
      else handle = registered;
    });

    return () => {
      removed = true;
      void handle?.remove();
    };
  }, [isAuthenticated]);
}
