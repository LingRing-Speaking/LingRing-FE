export type SocialProvider = "kakao" | "apple" | "google";

export interface User {
  id: number;
  nickname: string;
  profileImage: string | null;
  requiresOnboarding?: boolean;
  /** 사용자가 동의한 약관 시행일자 버전. 현재 LEGAL_TERMS_VERSION과 다르면 재동의 필요. */
  agreedTermsVersion?: string | null;
  /** 광고성 알림(푸시) 수신 동의 여부. */
  marketingPushAgreed?: boolean;
  /** 수신 동의·철회가 마지막으로 처리된 시각. 한 번도 동의한 적 없으면 null. */
  marketingPushUpdatedAt?: string | null;
}

export interface SocialLoginResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}
