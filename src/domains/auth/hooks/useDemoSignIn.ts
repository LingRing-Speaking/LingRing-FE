import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError } from "@/lib/http";
import { postDemoLogin } from "../api/demoLogin";
import { saveTokens } from "../storage";
import { useAuthStore } from "../store";

export type DemoSignInFailure =
  | { kind: "invalid_token"; message: string }
  | { kind: "api"; status: number; message: string }
  | { kind: "unknown"; message: string };

export interface UseDemoSignInResult {
  signIn: (token: string) => Promise<void>;
  isLoading: boolean;
  failure: DemoSignInFailure | null;
}

const FRIENDLY_MESSAGE = {
  invalid_token: "토큰이 일치하지 않아요.",
  unknown: "데모 로그인 중 알 수 없는 오류가 발생했어요. 잠시 후 다시 시도해주세요.",
} as const;

const UNAUTHORIZED_STATUS = 401;

function classify(err: unknown): DemoSignInFailure {
  if (err instanceof ApiError && err.status === UNAUTHORIZED_STATUS) {
    return { kind: "invalid_token", message: FRIENDLY_MESSAGE.invalid_token };
  }
  if (err instanceof ApiError) {
    return { kind: "api", status: err.status, message: err.message };
  }
  return { kind: "unknown", message: FRIENDLY_MESSAGE.unknown };
}

export function useDemoSignIn(): UseDemoSignInResult {
  const setSession = useAuthStore((state) => state.setSession);
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [failure, setFailure] = useState<DemoSignInFailure | null>(null);

  const signIn = useCallback(
    async (token: string) => {
      setIsLoading(true);
      setFailure(null);
      try {
        const result = await postDemoLogin({ token });
        await saveTokens({
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
        });
        setSession({
          user: result.user,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
        });
        const next = result.user.requiresOnboarding ? "/onboarding/terms" : "/home";
        navigate(next, { replace: true });
      } catch (err) {
        setFailure(classify(err));
      } finally {
        setIsLoading(false);
      }
    },
    [navigate, setSession],
  );

  return { signIn, isLoading, failure };
}
