import { beforeEach, describe, expect, it, vi } from "vitest";
import { logout } from "./api/logout";
import { logoutFromKakao } from "./kakao";
import { signOut } from "./signOut";
import { clearTokens } from "./storage";
import { useAuthStore } from "./store";

vi.mock("./api/logout", () => ({ logout: vi.fn() }));
vi.mock("./kakao", () => ({ logoutFromKakao: vi.fn() }));
vi.mock("./storage", () => ({ clearTokens: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({
    user: { id: 1, nickname: "tester", profileImage: null },
    accessToken: "test-access",
    refreshToken: "test-refresh",
    isAuthenticated: true,
  });
});

describe("signOut", () => {
  it("정상 흐름 — BE/카카오/로컬 모두 호출되고 store는 비워진다", async () => {
    vi.mocked(logout).mockResolvedValue(undefined);
    vi.mocked(logoutFromKakao).mockResolvedValue(undefined);
    vi.mocked(clearTokens).mockResolvedValue(undefined);

    await signOut();

    expect(logout).toHaveBeenCalledOnce();
    expect(logoutFromKakao).toHaveBeenCalledOnce();
    expect(clearTokens).toHaveBeenCalledOnce();
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.accessToken).toBeNull();
    expect(state.refreshToken).toBeNull();
  });

  it("BE 호출이 실패해도 카카오·로컬 정리는 진행된다", async () => {
    vi.mocked(logout).mockRejectedValue(new Error("network"));
    vi.mocked(logoutFromKakao).mockResolvedValue(undefined);
    vi.mocked(clearTokens).mockResolvedValue(undefined);

    await signOut();

    expect(logoutFromKakao).toHaveBeenCalledOnce();
    expect(clearTokens).toHaveBeenCalledOnce();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it("카카오 SDK 실패해도 로컬 정리는 진행된다", async () => {
    vi.mocked(logout).mockResolvedValue(undefined);
    vi.mocked(logoutFromKakao).mockRejectedValue(new Error("sdk"));
    vi.mocked(clearTokens).mockResolvedValue(undefined);

    await signOut();

    expect(clearTokens).toHaveBeenCalledOnce();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it("BE/카카오 둘 다 실패해도 로컬 정리는 진행된다", async () => {
    vi.mocked(logout).mockRejectedValue(new Error("network"));
    vi.mocked(logoutFromKakao).mockRejectedValue(new Error("sdk"));
    vi.mocked(clearTokens).mockResolvedValue(undefined);

    await signOut();

    expect(clearTokens).toHaveBeenCalledOnce();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});
