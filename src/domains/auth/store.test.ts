import { describe, it, expect, beforeEach } from "vitest";
import { useAuthStore } from "./store";

describe("useAuthStore", () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, isAuthenticated: false });
  });

  it("초기 상태는 비인증이다", () => {
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
  });

  it("setSession은 user를 채우고 인증 상태로 전환한다", () => {
    useAuthStore.getState().setSession({ id: 42, nickname: "funny-otter-1234" });
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user).toEqual({ id: 42, nickname: "funny-otter-1234" });
  });

  it("clearSession은 비인증 상태로 되돌린다", () => {
    useAuthStore.getState().setSession({ id: 42, nickname: "x" });
    useAuthStore.getState().clearSession();
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
  });
});
