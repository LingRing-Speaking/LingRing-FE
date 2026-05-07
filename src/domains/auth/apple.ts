import { SignInWithApple } from "@capacitor-community/apple-sign-in";
import { Capacitor } from "@capacitor/core";

const APPLE_CLIENT_ID = "com.lingring.app";
const APPLE_REDIRECT_URI = "";
// LingRing 은 email/name 사용처가 없어 권한 요청 자체를 하지 않음.
// `authorizationCode` 는 scope 와 무관하게 항상 응답에 포함되며, 본 앱은 BE 의
// Apple 토큰 revoke 흐름(LingRing-BE #77)을 위해 BE 로 forward 한다.
const APPLE_SCOPES = "";
const IOS_PLATFORM = "ios";

export interface AppleTokens {
  identityToken: string;
  authorizationCode: string;
}

export class AppleLoginUnavailableError extends Error {
  constructor() {
    super("애플 로그인은 iOS 앱에서만 지원합니다.");
    this.name = "AppleLoginUnavailableError";
  }
}

export class AppleIdentityTokenMissingError extends Error {
  constructor() {
    super("애플 응답에 identityToken이 없습니다.");
    this.name = "AppleIdentityTokenMissingError";
  }
}

function isAppleSignInSupported(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === IOS_PLATFORM;
}

export async function loginWithApple(): Promise<AppleTokens> {
  if (!isAppleSignInSupported()) {
    throw new AppleLoginUnavailableError();
  }

  const result = await SignInWithApple.authorize({
    clientId: APPLE_CLIENT_ID,
    redirectURI: APPLE_REDIRECT_URI,
    scopes: APPLE_SCOPES,
  });

  if (!result.response.identityToken) {
    throw new AppleIdentityTokenMissingError();
  }

  return {
    identityToken: result.response.identityToken,
    authorizationCode: result.response.authorizationCode,
  };
}
