import { httpPost } from "@/lib/http";
import type { SocialLoginResponse } from "../types";

interface PostDemoLoginInput {
  token: string;
}

/**
 * Apple App Review 리뷰어용 demo 로그인.
 * SIWA·Kakao 전용 앱이라 진짜 계정 발급이 2FA 때문에 비현실적이라 BE bypass 패턴 사용.
 * 토큰 → 시드된 demo user 매핑은 BE 환경변수에 정의되어 있음 (LingRing-BE #81).
 */
export function postDemoLogin(input: PostDemoLoginInput): Promise<SocialLoginResponse> {
  return httpPost<SocialLoginResponse>("/auth/demo-login", input);
}
