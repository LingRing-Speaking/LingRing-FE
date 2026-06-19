import { logoutFromKakao } from "./kakao";
import { clearTokens } from "./storage";
import { useAuthStore } from "./store";

// BE 작업이 끝난 뒤(로그아웃·탈퇴 성공) 호출하는 로컬 정리.
// 카카오 SDK 실패는 무시 — 로컬 토큰/세션 정리는 무조건 진행한다.
export async function clearLocalSession(): Promise<void> {
  try {
    await logoutFromKakao();
  } catch {
    // 카카오 SDK 측 logout 실패는 무시
  }
  await clearTokens();
  useAuthStore.getState().clearSession();
}
