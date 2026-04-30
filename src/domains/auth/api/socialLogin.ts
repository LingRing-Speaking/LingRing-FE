import { httpPost } from "@/lib/http";
import type { SocialLoginResponse, SocialProvider } from "../types";

interface PostSocialLoginInput {
  provider: SocialProvider;
  idToken: string;
  accessToken?: string;
  nickname?: string;
}

export function postSocialLogin(input: PostSocialLoginInput): Promise<SocialLoginResponse> {
  return httpPost<SocialLoginResponse>("/auth/social", input);
}
