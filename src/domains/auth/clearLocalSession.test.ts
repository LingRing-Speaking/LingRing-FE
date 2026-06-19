import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearLocalSession } from "./clearLocalSession";
import { logoutFromKakao } from "./kakao";
import { clearTokens } from "./storage";
import { useAuthStore } from "./store";

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

describe("clearLocalSession", () => {
  it("정상 흐름 — 카카오 SDK + 로컬 토큰 정리 + store clear", async () => {
    vi.mocked(logoutFromKakao).mockResolvedValue(undefined);
    vi.mocked(clearTokens).mockResolvedValue(undefined);

    await clearLocalSession();

    expect(logoutFromKakao).toHaveBeenCalledOnce();
    expect(clearTokens).toHaveBeenCalledOnce();
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.accessToken).toBeNull();
    expect(state.refreshToken).toBeNull();
  });

  it("카카오 SDK 실패해도 토큰 정리·store clear는 진행된다", async () => {
    vi.mocked(logoutFromKakao).mockRejectedValue(new Error("sdk"));
    vi.mocked(clearTokens).mockResolvedValue(undefined);

    await clearLocalSession();

    expect(clearTokens).toHaveBeenCalledOnce();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});
