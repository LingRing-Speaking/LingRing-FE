export type SocialProvider = "kakao" | "apple";

export interface User {
  id: number;
  nickname: string;
  profileImage: string | null;
  requiresOnboarding?: boolean;
}

export interface SocialLoginResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}
