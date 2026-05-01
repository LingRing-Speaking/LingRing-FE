import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { SplashPage } from "./SplashPage";

const SPLASH_MIN_MS = 1500;
const FADE_OUT_MS = 280;

vi.mock("@capacitor/splash-screen", () => ({
  SplashScreen: { hide: vi.fn() },
}));
vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: vi.fn(() => false) },
}));
vi.mock("@/domains/auth/store", () => ({
  useAuthStore: vi.fn(),
}));

import { SplashScreen } from "@capacitor/splash-screen";
import { Capacitor } from "@capacitor/core";
import { useAuthStore } from "@/domains/auth/store";

const mockHide = vi.mocked(SplashScreen.hide);
const mockIsNative = vi.mocked(Capacitor.isNativePlatform);
const mockAuthStore = vi.mocked(useAuthStore);

function setAuthState(isAuthenticated: boolean) {
  const state = {
    isAuthenticated,
    user: null,
    accessToken: null,
    refreshToken: null,
    setSession: vi.fn(),
    clearSession: vi.fn(),
  };
  mockAuthStore.mockImplementation((selector) =>
    typeof selector === "function" ? selector(state) : state,
  );
}

function renderSplash() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<SplashPage />} />
        <Route path="/login" element={<div>로그인 화면</div>} />
        <Route path="/home" element={<div>홈 화면</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("SplashPage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockHide.mockClear();
    mockIsNative.mockReset();
    mockIsNative.mockReturnValue(false);
    setAuthState(false);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("로고와 워드마크를 노출한다", () => {
    renderSplash();

    expect(screen.getByRole("img", { name: "LingRing" })).toBeInTheDocument();
    expect(screen.getByText("Ling")).toBeInTheDocument();
    expect(screen.getByText("Ring")).toBeInTheDocument();
  });

  it("미인증 상태에서 최소 노출 + 페이드아웃 후 /login 으로 navigate 한다", async () => {
    setAuthState(false);
    renderSplash();

    expect(screen.queryByText("로그인 화면")).not.toBeInTheDocument();

    await vi.advanceTimersByTimeAsync(SPLASH_MIN_MS + FADE_OUT_MS);

    expect(screen.getByText("로그인 화면")).toBeInTheDocument();
  });

  it("인증 상태에서는 /home 으로 navigate 한다", async () => {
    setAuthState(true);
    renderSplash();

    await vi.advanceTimersByTimeAsync(SPLASH_MIN_MS + FADE_OUT_MS);

    expect(screen.getByText("홈 화면")).toBeInTheDocument();
  });

  it("최소 노출 시간 전에는 navigate 하지 않는다 (브랜드 모먼트 보장)", async () => {
    setAuthState(false);
    renderSplash();

    await vi.advanceTimersByTimeAsync(SPLASH_MIN_MS - 100);

    expect(screen.queryByText("로그인 화면")).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "LingRing" })).toBeInTheDocument();
  });

  it("네이티브 환경에서는 마운트 즉시 SplashScreen.hide() 를 호출한다", () => {
    mockIsNative.mockReturnValue(true);

    renderSplash();

    expect(mockHide).toHaveBeenCalledOnce();
  });

  it("웹 환경에서는 SplashScreen.hide() 를 호출하지 않는다", () => {
    mockIsNative.mockReturnValue(false);

    renderSplash();

    expect(mockHide).not.toHaveBeenCalled();
  });
});
