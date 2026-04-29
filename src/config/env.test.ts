import { describe, expect, it } from "vitest";

describe("env", () => {
  it("Vite 가 주입한 VITE_API_BASE_URL 과 VITE_DEV_USER_ID 를 노출한다", async () => {
    const { env } = await import("./env");
    expect(env.apiBaseUrl).toBe("http://localhost:3000");
    expect(env.devUserId).toBe(1);
  });

  it("wsBaseUrl 은 apiBaseUrl 의 http 스킴을 ws 로 치환한다", async () => {
    const { env } = await import("./env");
    expect(env.wsBaseUrl).toBe("ws://localhost:3000");
  });
});
