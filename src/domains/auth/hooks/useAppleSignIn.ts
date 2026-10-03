import { ApiError } from "@/lib/http";
import { AppleIdentityTokenMissingError, AppleLoginUnavailableError } from "../apple";
import { NicknameRetryExhaustedError, signInWithApple } from "../signIn";
import { useSocialSignIn, type UseSocialSignInResult } from "./useSocialSignIn";

export type AppleSignInFailure =
  | { kind: "unavailable"; message: string }
  | { kind: "identity_token_missing"; message: string }
  | { kind: "nickname_retry_exhausted"; message: string }
  | { kind: "api"; status: number; message: string }
  | { kind: "unknown"; message: string };

export type UseAppleSignInResult = UseSocialSignInResult<AppleSignInFailure>;

const FRIENDLY_MESSAGE = {
  unavailable: "Apple 로그인은 iOS 앱에서만 가능해요.",
  identity_token_missing: "로그인을 마치지 못했어요. 잠시 후 다시 시도해주세요.",
  nickname_retry_exhausted:
    "잠시 문제가 발생했어요. 잠시 후 다시 시도해도 같은 화면이 보이면 고객센터로 문의해주세요.",
  unknown: "로그인 중 알 수 없는 오류가 발생했어요. 잠시 후 다시 시도해주세요.",
} as const;

function classify(err: unknown): AppleSignInFailure {
  if (err instanceof AppleLoginUnavailableError) {
    return { kind: "unavailable", message: FRIENDLY_MESSAGE.unavailable };
  }
  if (err instanceof AppleIdentityTokenMissingError) {
    return {
      kind: "identity_token_missing",
      message: FRIENDLY_MESSAGE.identity_token_missing,
    };
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

export function useAppleSignIn(): UseAppleSignInResult {
  return useSocialSignIn({ provider: "apple", signIn: signInWithApple, classify });
}
