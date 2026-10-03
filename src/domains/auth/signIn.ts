import { ApiError } from "@/lib/http";
import { postSocialLogin } from "./api/socialLogin";
import { loginWithApple } from "./apple";
import { loginWithGoogle } from "./google";
import { loginWithKakao } from "./kakao";
import { generateNickname } from "./nickname";
import type { SocialLoginResponse, SocialProvider } from "./types";

const NICKNAME_RETRY_LIMIT = 5;
const CONFLICT_STATUS = 409;
// 1년 내 탈퇴 이력이 있는 소셜 계정 (LingRing-BE #205). 같은 409라도 닉네임 충돌과 달리
// 닉네임을 바꿔도 해소되지 않으므로 재시도하지 않고 사용자 확인을 받는다.
const REJOIN_CONFIRMATION_REQUIRED_CODE = "REJOIN_CONFIRMATION_REQUIRED";

export class NicknameRetryExhaustedError extends Error {
  constructor() {
    super("닉네임 충돌이 반복돼 가입을 완료하지 못했습니다. 잠시 후 다시 시도해주세요.");
    this.name = "NicknameRetryExhaustedError";
  }
}

export interface SocialSignInInput {
  provider: SocialProvider;
  idToken: string;
  accessToken?: string;
  authorizationCode?: string;
  rejoinConfirmed?: boolean;
}

/**
 * 탈퇴 이력 때문에 가입이 보류됨. 사용자가 재가입을 확인하면 `pendingSignIn` 을
 * `confirmRejoin` 에 넘겨 소셜 로그인을 다시 띄우지 않고 이어서 가입한다.
 */
export class RejoinConfirmationRequiredError extends Error {
  constructor(public readonly pendingSignIn: SocialSignInInput) {
    super("최근 탈퇴한 계정이라 재가입 확인이 필요합니다.");
    this.name = "RejoinConfirmationRequiredError";
  }
}

function isConflict(err: unknown): err is ApiError {
  return err instanceof ApiError && err.status === CONFLICT_STATUS;
}

async function signInWithSocial(input: SocialSignInInput): Promise<SocialLoginResponse> {
  for (let attempt = 0; attempt < NICKNAME_RETRY_LIMIT; attempt += 1) {
    try {
      return await postSocialLogin({
        ...input,
        nickname: generateNickname(),
      });
    } catch (err) {
      if (!isConflict(err)) throw err;
      if (err.code === REJOIN_CONFIRMATION_REQUIRED_CODE) {
        throw new RejoinConfirmationRequiredError(input);
      }
      // 그 외 409는 닉네임 충돌. code 필드가 없는 구버전 BE 응답도 여기로 온다.
    }
  }
  throw new NicknameRetryExhaustedError();
}

export function confirmRejoin(pendingSignIn: SocialSignInInput): Promise<SocialLoginResponse> {
  return signInWithSocial({ ...pendingSignIn, rejoinConfirmed: true });
}

export async function signInWithKakao(): Promise<SocialLoginResponse> {
  const tokens = await loginWithKakao();
  return signInWithSocial({
    provider: "kakao",
    idToken: tokens.idToken,
    accessToken: tokens.accessToken,
  });
}

export async function signInWithApple(): Promise<SocialLoginResponse> {
  const tokens = await loginWithApple();
  return signInWithSocial({
    provider: "apple",
    idToken: tokens.identityToken,
    authorizationCode: tokens.authorizationCode,
  });
}

export async function signInWithGoogle(): Promise<SocialLoginResponse> {
  const tokens = await loginWithGoogle();
  return signInWithSocial({
    provider: "google",
    idToken: tokens.idToken,
  });
}
