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
vi.mock("@/domains/auth/sessionRestore", () => ({
  restoreSession: vi.fn(),
}));

import { SplashScreen } from "@capacitor/splash-screen";
import { Capacitor } from "@capacitor/core";
import { restoreSession } from "@/domains/auth/sessionRestore";

const mockHide = vi.mocked(SplashScreen.hide);
const mockIsNative = vi.mocked(Capacitor.isNativePlatform);
const mockRestore = vi.mocked(restoreSession);

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
    mockRestore.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("로고와 워드마크를 노출한다", () => {
    mockRestore.mockResolvedValue({ kind: "no_tokens" });

    renderSplash();

    expect(screen.getByRole("img", { name: "LingRing" })).toBeInTheDocument();
    expect(screen.getByText("Ling")).toBeInTheDocument();
    expect(screen.getByText("Ring")).toBeInTheDocument();
  });

  it("토큰이 없으면 최소 노출 + 페이드아웃 후 /login 으로 navigate 한다", async () => {
    mockRestore.mockResolvedValue({ kind: "no_tokens" });

    renderSplash();
    expect(screen.queryByText("로그인 화면")).not.toBeInTheDocument();

    await vi.advanceTimersByTimeAsync(SPLASH_MIN_MS + FADE_OUT_MS);

    expect(screen.getByText("로그인 화면")).toBeInTheDocument();
  });

  it("세션 복원 성공 시 /home 으로 navigate 한다", async () => {
    mockRestore.mockResolvedValue({ kind: "restored" });

    renderSplash();

    await vi.advanceTimersByTimeAsync(SPLASH_MIN_MS + FADE_OUT_MS);

    expect(screen.getByText("홈 화면")).toBeInTheDocument();
  });

  it("토큰 무효(invalid)면 /login 으로 navigate 한다", async () => {
    mockRestore.mockResolvedValue({ kind: "invalid" });

    renderSplash();

    await vi.advanceTimersByTimeAsync(SPLASH_MIN_MS + FADE_OUT_MS);

    expect(screen.getByText("로그인 화면")).toBeInTheDocument();
  });

  it("네트워크 오류여도 /login 으로 navigate 한다 (사용자 회복 가능 경로 보장)", async () => {
    mockRestore.mockResolvedValue({ kind: "network_error" });

    renderSplash();

    await vi.advanceTimersByTimeAsync(SPLASH_MIN_MS + FADE_OUT_MS);

    expect(screen.getByText("로그인 화면")).toBeInTheDocument();
  });

  it("최소 노출 시간 전에는 navigate 하지 않는다 (브랜드 모먼트 보장)", async () => {
    mockRestore.mockResolvedValue({ kind: "restored" });

    renderSplash();

    await vi.advanceTimersByTimeAsync(SPLASH_MIN_MS - 100);

    expect(screen.queryByText("홈 화면")).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "LingRing" })).toBeInTheDocument();
  });

  it("restoreSession 이 늦게 끝나도 끝날 때까지 기다린 뒤에만 navigate 한다", async () => {
    let resolveRestore: (value: { kind: "restored" }) => void = () => {};
    mockRestore.mockReturnValue(
      new Promise((resolve) => {
        resolveRestore = resolve as typeof resolveRestore;
      }),
    );

    renderSplash();

    await vi.advanceTimersByTimeAsync(SPLASH_MIN_MS + FADE_OUT_MS);

    expect(screen.queryByText("홈 화면")).not.toBeInTheDocument();
    expect(screen.queryByText("로그인 화면")).not.toBeInTheDocument();

    resolveRestore({ kind: "restored" });
    await vi.advanceTimersByTimeAsync(FADE_OUT_MS);

    expect(screen.getByText("홈 화면")).toBeInTheDocument();
  });

  it("네이티브 환경에서는 마운트 즉시 SplashScreen.hide() 를 호출한다", () => {
    mockRestore.mockResolvedValue({ kind: "no_tokens" });
    mockIsNative.mockReturnValue(true);

    renderSplash();

    expect(mockHide).toHaveBeenCalledOnce();
  });

  it("웹 환경에서는 SplashScreen.hide() 를 호출하지 않는다", () => {
    mockRestore.mockResolvedValue({ kind: "no_tokens" });
    mockIsNative.mockReturnValue(false);

    renderSplash();

    expect(mockHide).not.toHaveBeenCalled();
  });
});
