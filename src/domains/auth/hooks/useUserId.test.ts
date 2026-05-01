import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useAuthStore } from "../store";
import { useUserId } from "./useUserId";

describe("useUserId", () => {
  it("인증된 사용자가 있으면 user.id 를 반환한다", () => {
    useAuthStore.setState({
      user: { id: 42, nickname: "happy-tiger-1234" },
      accessToken: "access",
      refreshToken: "refresh",
      isAuthenticated: true,
    });

    const { result } = renderHook(() => useUserId());

    expect(result.current).toBe(42);
  });

  it("store 의 user 값이 바뀌면 새 id 를 반환한다", () => {
    useAuthStore.setState({
      user: { id: 7, nickname: "first" },
      accessToken: "a",
      refreshToken: "r",
      isAuthenticated: true,
    });

    const { result, rerender } = renderHook(() => useUserId());
    expect(result.current).toBe(7);

    useAuthStore.setState({
      user: { id: 99, nickname: "second" },
      accessToken: "a",
      refreshToken: "r",
      isAuthenticated: true,
    });
    rerender();

    expect(result.current).toBe(99);
  });
});
