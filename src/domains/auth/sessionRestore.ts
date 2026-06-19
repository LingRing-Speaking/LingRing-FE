import { ApiError } from "@/lib/http";
import { getMe } from "./api/me";
import { clearTokens, loadTokens } from "./storage";
import { useAuthStore } from "./store";

const UNAUTHORIZED_STATUS = 401;

export type SessionRestoreResult =
  | { kind: "restored" }
  | { kind: "no_tokens" }
  | { kind: "invalid" }
  | { kind: "network_error" };

export async function restoreSession(): Promise<SessionRestoreResult> {
  const tokens = await loadTokens();
  if (!tokens) return { kind: "no_tokens" };

  useAuthStore.getState().updateTokens(tokens);

  try {
    const user = await getMe();
    useAuthStore.getState().setSession({
      user,
      accessToken: useAuthStore.getState().accessToken!,
      refreshToken: useAuthStore.getState().refreshToken!,
    });
    return { kind: "restored" };
  } catch (err) {
    if (err instanceof ApiError && err.status === UNAUTHORIZED_STATUS) {
      useAuthStore.getState().clearSession();
      await clearTokens();
      return { kind: "invalid" };
    }
    return { kind: "network_error" };
  }
}
