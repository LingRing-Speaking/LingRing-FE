import { beforeEach, describe, expect, it, vi } from "vitest";

describe("env", () => {
  beforeEach(() => {
    window.sessionStorage.removeItem("dev_user_id");
    window.history.replaceState({}, "", "/");
    vi.resetModules();
  });

  it("Vite 가 주입한 VITE_API_BASE_URL 과 VITE_DEV_USER_ID 를 노출한다", async () => {
    const { env } = await import("./env");
    expect(env.apiBaseUrl).toBe("http://localhost:3000");
    expect(env.devUserId).toBe(1);
  });

  it("wsBaseUrl 은 apiBaseUrl 의 http 스킴을 ws 로 치환한다", async () => {
    const { env } = await import("./env");
    expect(env.wsBaseUrl).toBe("ws://localhost:3000");
  });

  it("?userId=N URL 쿼리가 있으면 그 값을 사용하고 URL 에서 제거한다", async () => {
    window.history.replaceState({}, "", "/?userId=42");

    const { env } = await import("./env");

    expect(env.devUserId).toBe(42);
    expect(window.location.search).toBe("");
    expect(window.sessionStorage.getItem("dev_user_id")).toBe("42");
  });

  it("URL 쿼리 없이 sessionStorage 만 있으면 그 값을 사용한다", async () => {
    window.sessionStorage.setItem("dev_user_id", "7");

    const { env } = await import("./env");

    expect(env.devUserId).toBe(7);
  });

  it("URL 도 sessionStorage 도 없으면 VITE_DEV_USER_ID 로 폴백한다", async () => {
    const { env } = await import("./env");

    expect(env.devUserId).toBe(1);
  });
});
