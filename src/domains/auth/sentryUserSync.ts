import { setSentryUser } from "@/lib/sentry";
import { useAuthStore } from "./store";

// 모든 세션 변화(로그인·복원·로그아웃·탈퇴·401 무효화)는 useAuthStore 를 지난다.
// 개별 흐름마다 호출을 흩뿌리는 대신 store 구독 한 곳에서 Sentry user 를 동기화한다.
// 반환값: 구독 해제 함수 (테스트 정리용 — 앱에서는 수명 내내 유지).
export function startSentryUserSync(): () => void {
  let prevUserId = useAuthStore.getState().user?.id ?? null;

  return useAuthStore.subscribe((state) => {
    const userId = state.user?.id ?? null;
    if (userId === prevUserId) return;
    prevUserId = userId;
    setSentryUser(userId);
  });
}
