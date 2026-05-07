import { ApiError } from "@/lib/http";
import { postSocialLogin } from "./api/socialLogin";
import { loginWithApple } from "./apple";
import { loginWithKakao } from "./kakao";
import { generateNickname } from "./nickname";
import type { SocialLoginResponse, SocialProvider } from "./types";

const NICKNAME_RETRY_LIMIT = 5;
const NICKNAME_CONFLICT_STATUS = 409;

export class NicknameRetryExhaustedError extends Error {
  constructor() {
    super("닉네임 충돌이 반복돼 가입을 완료하지 못했습니다. 잠시 후 다시 시도해주세요.");
    this.name = "NicknameRetryExhaustedError";
  }
}

interface SocialSignInInput {
  provider: SocialProvider;
  idToken: string;
  accessToken?: string;
  authorizationCode?: string;
}

async function signInWithSocial(input: SocialSignInInput): Promise<SocialLoginResponse> {
  for (let attempt = 0; attempt < NICKNAME_RETRY_LIMIT; attempt += 1) {
    try {
      return await postSocialLogin({
        ...input,
        nickname: generateNickname(),
      });
    } catch (err) {
      const isNicknameConflict = err instanceof ApiError && err.status === NICKNAME_CONFLICT_STATUS;
      if (isNicknameConflict) continue;
      throw err;
    }
  }
  throw new NicknameRetryExhaustedError();
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
