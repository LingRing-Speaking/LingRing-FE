import { useAuthStore } from "../store";

export function useUserId(): number {
  const userId = useAuthStore((state) => state.user?.id);
  if (userId == null) {
    throw new Error("useUserId 는 인증된 라우트(AuthGuard 통과 후)에서만 호출해야 합니다.");
  }
  return userId;
}
