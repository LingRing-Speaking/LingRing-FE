import { SignInWithApple } from "@capacitor-community/apple-sign-in";
import { Capacitor } from "@capacitor/core";

const APPLE_CLIENT_ID = "com.lingring.app";
const APPLE_REDIRECT_URI = "";
const APPLE_SCOPES = "email name";
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
