import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError } from "@/lib/http";
import { GoogleIdTokenMissingError, GoogleLoginUnavailableError } from "../google";
import { NicknameRetryExhaustedError, signInWithGoogle } from "../signIn";
import { saveTokens } from "../storage";
import { useAuthStore } from "../store";
import { needsAgreement } from "@/domains/onboarding/needsAgreement";

export type GoogleSignInFailure =
  | { kind: "unavailable"; message: string }
  | { kind: "id_token_missing"; message: string }
  | { kind: "nickname_retry_exhausted"; message: string }
  | { kind: "api"; status: number; message: string }
  | { kind: "unknown"; message: string };

export interface UseGoogleSignInResult {
  signIn: () => Promise<void>;
  isLoading: boolean;
  failure: GoogleSignInFailure | null;
}

const FRIENDLY_MESSAGE = {
  unavailable: "구글 로그인은 모바일 앱에서만 가능해요.",
  id_token_missing: "로그인을 마치지 못했어요. 잠시 후 다시 시도해주세요.",
  nickname_retry_exhausted:
    "잠시 문제가 발생했어요. 잠시 후 다시 시도해도 같은 화면이 보이면 고객센터로 문의해주세요.",
  unknown: "로그인 중 알 수 없는 오류가 발생했어요. 잠시 후 다시 시도해주세요.",
} as const;

function classify(err: unknown): GoogleSignInFailure {
  if (err instanceof GoogleLoginUnavailableError) {
    return { kind: "unavailable", message: FRIENDLY_MESSAGE.unavailable };
  }
  if (err instanceof GoogleIdTokenMissingError) {
    return { kind: "id_token_missing", message: FRIENDLY_MESSAGE.id_token_missing };
  }
  if (err instanceof NicknameRetryExhaustedError) {
    return {
      kind: "nickname_retry_exhausted",
      message: FRIENDLY_MESSAGE.nickname_retry_exhausted,
    };
  }
  if (err instanceof ApiError) {
    return { kind: "api", status: err.status, message: err.message };
  }
  return { kind: "unknown", message: FRIENDLY_MESSAGE.unknown };
}

export function useGoogleSignIn(): UseGoogleSignInResult {
  const setSession = useAuthStore((state) => state.setSession);
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [failure, setFailure] = useState<GoogleSignInFailure | null>(null);

  const signIn = useCallback(async () => {
    setIsLoading(true);
    setFailure(null);
    try {
      const result = await signInWithGoogle();
      await saveTokens({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      });
      setSession({
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      });
      const next = needsAgreement(result.user) ? "/onboarding/terms" : "/home";
      navigate(next, { replace: true });
    } catch (err) {
      setFailure(classify(err));
    } finally {
      setIsLoading(false);
    }
  }, [navigate, setSession]);

  return { signIn, isLoading, failure };
}
