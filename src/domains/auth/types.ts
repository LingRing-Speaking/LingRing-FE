export type SocialProvider = "kakao" | "apple";

export interface User {
  id: number;
  nickname: string;
  profileImage: string | null;
  requiresOnboarding?: boolean;
  /** 사용자가 동의한 약관 시행일자 버전. 현재 LEGAL_TERMS_VERSION과 다르면 재동의 필요. */
  agreedTermsVersion?: string | null;
}

export interface SocialLoginResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}
