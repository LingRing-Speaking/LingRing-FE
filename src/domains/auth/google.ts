import { Capacitor } from "@capacitor/core";
import { SocialLogin } from "@capgo/capacitor-social-login";

// GCP 콘솔(Lingring 프로젝트)에서 발급한 OAuth client ID. 시크릿이 아니라 배포물에
// 포함되는 공개 식별자다 (애플의 APPLE_CLIENT_ID 하드코딩과 같은 관례).
// Android 로그인은 web client ID를, iOS 로그인은 iOS client ID를 사용한다.
const GOOGLE_WEB_CLIENT_ID =
  "393487987098-d2aupcoa08popjt19u6p65jd5m1fsld7.apps.googleusercontent.com";
const GOOGLE_IOS_CLIENT_ID =
  "393487987098-fmb01i23fhup8sh6otp3h03cqf1fse6v.apps.googleusercontent.com";

export interface GoogleTokens {
  idToken: string;
}

export class GoogleLoginUnavailableError extends Error {
  constructor() {
    super("구글 로그인은 모바일 환경에서만 지원합니다.");
    this.name = "GoogleLoginUnavailableError";
  }
}

export class GoogleIdTokenMissingError extends Error {
  constructor() {
    super("구글 응답에 id_token이 없습니다.");
    this.name = "GoogleIdTokenMissingError";
  }
}

let initialized = false;

async function ensureInitialized(): Promise<void> {
  if (initialized) return;
  await SocialLogin.initialize({
    google: {
      webClientId: GOOGLE_WEB_CLIENT_ID,
      iOSClientId: GOOGLE_IOS_CLIENT_ID,
    },
  });
  initialized = true;
}

export async function loginWithGoogle(): Promise<GoogleTokens> {
  if (!Capacitor.isNativePlatform()) {
    throw new GoogleLoginUnavailableError();
  }

  await ensureInitialized();

  // scopes를 넘기면 Android에서 MainActivity 수정 없이는 플러그인이 로그인을
  // 거부한다. id_token에 email·profile 클레임이 기본 포함되므로 지정하지 않는다.
  const { result } = await SocialLogin.login({
    provider: "google",
    options: {},
  });

  if (!("idToken" in result) || !result.idToken) {
    throw new GoogleIdTokenMissingError();
  }

  return { idToken: result.idToken };
}
