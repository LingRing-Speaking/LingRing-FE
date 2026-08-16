import { useEffect } from "react";
import { App } from "@capacitor/app";
import type { PluginListenerHandle } from "@capacitor/core";
import { useAuthStore } from "@/domains/auth/store";
import { recoveryRun } from "./recordingRecovery";

/**
 * 잔여 녹음 파일의 업로드 재시도를 언제 돌릴지 결정한다. App 최상단에서 한 번만 마운트한다.
 *
 * 두 시점에 돈다:
 * - 인증이 확립된 직후 (앱 시작 시 세션 복원 완료 / 로그인 성공)
 *   App mount 시점에 돌리면 세션 복원(restoreSession)이 토큰을 스토어에 넣기 전이라
 *   Authorization 헤더 없는 요청이 나가 401 을 받는다.
 * - 포그라운드 복귀 시
 *   iOS 는 앱을 서스펜드 상태로 오래 살려두므로 다시 열어도 App 이 remount 되지 않는다.
 *   시작 시점 트리거만으로는 며칠째 재시도가 한 번도 안 걸릴 수 있다.
 */
export function useRecordingRecovery(): void {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated) return;

    void recoveryRun();

    let removed = false;
    let handle: PluginListenerHandle | null = null;
    void App.addListener("appStateChange", ({ isActive }) => {
      if (isActive) void recoveryRun();
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
