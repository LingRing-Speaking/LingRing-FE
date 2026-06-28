import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// useAppleSignIn 훅이 부수적으로 끌어오는 네이티브 플러그인·라우터를 격리한다.
// 이 테스트의 관심사는 "플랫폼별로 애플 버튼이 보이는가"뿐이다.
vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: vi.fn(() => false),
    getPlatform: vi.fn(() => "web"),
  },
}));
vi.mock("@capacitor-community/apple-sign-in", () => ({
  SignInWithApple: { authorize: vi.fn() },
}));
vi.mock("capacitor-kakao-login-plugin", () => ({
  KakaoLoginPlugin: { goLogin: vi.fn(), goLogout: vi.fn() },
}));
vi.mock("@capacitor/preferences", () => ({
  Preferences: {
    set: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue({ value: null }),
    remove: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));

import { Capacitor } from "@capacitor/core";
import { AppleSignInButton } from "./AppleSignInButton";

const mockIsNative = vi.mocked(Capacitor.isNativePlatform);
const mockGetPlatform = vi.mocked(Capacitor.getPlatform);

const APPLE_BUTTON_NAME = "Apple로 로그인";

function setPlatform(native: boolean, platform: string) {
  mockIsNative.mockReturnValue(native);
  mockGetPlatform.mockReturnValue(platform);
}

describe("AppleSignInButton", () => {
  beforeEach(() => {
    mockIsNative.mockReset();
    mockGetPlatform.mockReset();
  });

  it("iOS 네이티브에서는 애플 로그인 버튼을 노출한다", () => {
    setPlatform(true, "ios");
    render(<AppleSignInButton />);
    expect(screen.getByRole("button", { name: APPLE_BUTTON_NAME })).toBeInTheDocument();
  });

  it("Android 네이티브에서는 애플 로그인 버튼을 숨긴다", () => {
    setPlatform(true, "android");
    const { container } = render(<AppleSignInButton />);
    expect(screen.queryByRole("button", { name: APPLE_BUTTON_NAME })).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  it("웹에서는 애플 로그인 버튼을 숨긴다", () => {
    setPlatform(false, "web");
    render(<AppleSignInButton />);
    expect(screen.queryByRole("button", { name: APPLE_BUTTON_NAME })).not.toBeInTheDocument();
  });
});
