import { httpPost } from "@/lib/http";
import type { SocialLoginResponse, SocialProvider } from "../types";

interface PostSocialLoginInput {
  provider: SocialProvider;
  idToken: string;
  accessToken?: string;
  nickname?: string;
  /**
   * Apple Sign-In 첫 인증 시에만 응답에 포함되는 1회성 코드.
   * BE 가 이걸로 Apple `refresh_token` 을 exchange 하여 저장하고,
   * 탈퇴 시 `/auth/revoke` 호출에 사용한다 (LingRing-BE #77).
   */
  authorizationCode?: string;
  /** 1년 내 탈퇴 이력이 있는 계정의 재가입 의사. 미전송 시 BE 는 false 로 본다 (LingRing-BE #205). */
  rejoinConfirmed?: boolean;
}

export function postSocialLogin(input: PostSocialLoginInput): Promise<SocialLoginResponse> {
  return httpPost<SocialLoginResponse>("/auth/social", input);
}
