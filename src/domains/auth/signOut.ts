import { logout as logoutOnServer } from "./api/logout";
import { logoutFromKakao } from "./kakao";
import { clearTokens } from "./storage";
import { useAuthStore } from "./store";

// 로컬 세션은 어떤 일이 있어도 끊는다. BE/카카오 SDK 호출 실패가 사용자를 로그인 상태로 묶어두는 일은 없어야 함.
export async function signOut(): Promise<void> {
  try {
    await logoutOnServer();
  } catch {
    // BE 로그아웃 실패는 무시 — 네트워크가 끊겨도 로컬 세션은 끊는다
  }
  // 카카오 SDK goLogout()이 콜백을 돌려주지 않고 hang하는 경우가 있어 await하지 않는다 — 로컬 세션 정리가 카카오 응답에 묶이지 않게.
  void logoutFromKakao().catch(() => {});

  await clearTokens();
  useAuthStore.getState().clearSession();
}
