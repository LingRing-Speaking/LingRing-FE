import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: vi.fn() },
}));
vi.mock("@capgo/capacitor-social-login", () => ({
  SocialLogin: { initialize: vi.fn(), login: vi.fn() },
}));

import { Capacitor } from "@capacitor/core";
import { SocialLogin } from "@capgo/capacitor-social-login";

const mockIsNative = vi.mocked(Capacitor.isNativePlatform);
const mockInitialize = vi.mocked(SocialLogin.initialize);
const mockLogin = vi.mocked(SocialLogin.login);

// initialize 1회 보장이 모듈 레벨 플래그라 테스트마다 모듈을 새로 로드한다.
// (에러 클래스 instanceof 비교를 위해 각 테스트는 같은 import 결과만 사용)
async function loadGoogleModule() {
  return await import("./google");
}

function mockLoginSuccess(idToken: string | null) {
  mockLogin.mockResolvedValue({
    provider: "google",
    result: {
      idToken,
      accessToken: null,
      profile: {
        email: null,
        familyName: null,
        givenName: null,
        id: null,
        name: null,
        imageUrl: null,
      },
      responseType: "online",
    },
  } as Awaited<ReturnType<typeof SocialLogin.login>>);
}

describe("loginWithGoogle", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
  });

  it("웹(비네이티브)에서는 GoogleLoginUnavailableError를 던진다", async () => {
    mockIsNative.mockReturnValue(false);
    const { loginWithGoogle, GoogleLoginUnavailableError } = await loadGoogleModule();

    await expect(loginWithGoogle()).rejects.toBeInstanceOf(GoogleLoginUnavailableError);
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it("네이티브에서 initialize 후 login하고 idToken을 반환한다", async () => {
    mockIsNative.mockReturnValue(true);
    mockLoginSuccess("google-id-jwt");
    const { loginWithGoogle } = await loadGoogleModule();

    const tokens = await loginWithGoogle();

    expect(tokens).toEqual({ idToken: "google-id-jwt" });
    expect(mockInitialize).toHaveBeenCalledTimes(1);
    expect(mockLogin).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "google" }),
    );
  });

  it("두 번 로그인해도 initialize는 한 번만 호출한다", async () => {
    mockIsNative.mockReturnValue(true);
    mockLoginSuccess("google-id-jwt");
    const { loginWithGoogle } = await loadGoogleModule();

    await loginWithGoogle();
    await loginWithGoogle();

    expect(mockInitialize).toHaveBeenCalledTimes(1);
    expect(mockLogin).toHaveBeenCalledTimes(2);
  });

  it("응답에 idToken이 없으면 GoogleIdTokenMissingError를 던진다", async () => {
    mockIsNative.mockReturnValue(true);
    mockLoginSuccess(null);
    const { loginWithGoogle, GoogleIdTokenMissingError } = await loadGoogleModule();

    await expect(loginWithGoogle()).rejects.toBeInstanceOf(GoogleIdTokenMissingError);
  });
});
