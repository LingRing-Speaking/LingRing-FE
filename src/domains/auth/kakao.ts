import { Capacitor } from "@capacitor/core";
import { KakaoLoginPlugin } from "capacitor-kakao-login-plugin";

export interface KakaoTokens {
  idToken: string;
  accessToken: string;
}

export class KakaoLoginUnavailableError extends Error {
  constructor() {
    super("카카오 로그인은 모바일 환경에서만 지원합니다.");
    this.name = "KakaoLoginUnavailableError";
  }
}

export class KakaoIdTokenMissingError extends Error {
  constructor() {
    super("카카오 응답에 id_token이 없습니다. 콘솔에서 OpenID Connect 활성화를 확인하세요.");
    this.name = "KakaoIdTokenMissingError";
  }
}

export async function loginWithKakao(): Promise<KakaoTokens> {
  if (!Capacitor.isNativePlatform()) {
    throw new KakaoLoginUnavailableError();
  }

  const result = await KakaoLoginPlugin.goLogin();

  if (!result.idToken) {
    throw new KakaoIdTokenMissingError();
  }

  return {
    idToken: result.idToken,
    accessToken: result.accessToken,
  };
}

export async function logoutFromKakao(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await KakaoLoginPlugin.goLogout();
}
