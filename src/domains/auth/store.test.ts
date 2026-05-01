import { describe, it, expect, beforeEach } from "vitest";
import { useAuthStore } from "./store";

const SAMPLE_SESSION = {
  user: { id: 42, nickname: "funny-otter-1234" },
  accessToken: "access-jwt",
  refreshToken: "refresh-jwt",
};

describe("useAuthStore", () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
    });
  });

  it("초기 상태는 비인증이고 토큰도 비어 있다", () => {
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.accessToken).toBeNull();
    expect(state.refreshToken).toBeNull();
  });

  it("setSession은 user/토큰을 채우고 인증 상태로 전환한다", () => {
    useAuthStore.getState().setSession(SAMPLE_SESSION);
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user).toEqual(SAMPLE_SESSION.user);
    expect(state.accessToken).toBe("access-jwt");
    expect(state.refreshToken).toBe("refresh-jwt");
  });

  it("clearSession은 비인증 + 토큰 비움", () => {
    useAuthStore.getState().setSession(SAMPLE_SESSION);
    useAuthStore.getState().clearSession();
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.accessToken).toBeNull();
    expect(state.refreshToken).toBeNull();
  });

  it("updateTokens는 user를 보존한 채 토큰만 갱신한다", () => {
    useAuthStore.getState().setSession(SAMPLE_SESSION);
    useAuthStore.getState().updateTokens({
      accessToken: "new-access",
      refreshToken: "new-refresh",
    });
    const state = useAuthStore.getState();
    expect(state.user).toEqual(SAMPLE_SESSION.user);
    expect(state.accessToken).toBe("new-access");
    expect(state.refreshToken).toBe("new-refresh");
    expect(state.isAuthenticated).toBe(true);
  });

  it("updateTokens는 user가 없는 상태(부팅 직후)에서도 토큰만 셋한다", () => {
    useAuthStore.getState().updateTokens({
      accessToken: "boot-access",
      refreshToken: "boot-refresh",
    });
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.accessToken).toBe("boot-access");
    expect(state.refreshToken).toBe("boot-refresh");
    expect(state.isAuthenticated).toBe(false);
  });
});
