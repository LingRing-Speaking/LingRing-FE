import { describe, expect, it } from "vitest";
import { fetchUserMy, fetchUserStats } from "./userApi";

describe("userApi", () => {
  it("fetchUserMy 는 /users/:id/my 를 호출해 UserMy 를 반환한다", async () => {
    const result = await fetchUserMy(1);

    expect(result).toEqual({ id: 1, name: "Lee" });
  });

  it("fetchUserStats 는 /users/:id/stats 를 호출해 UserStats 를 반환한다", async () => {
    const result = await fetchUserStats(1);

    expect(result).toMatchObject({
      userId: 1,
      level: "INTERMEDIATE",
      mannerTemperature: 36.5,
      totalCallCount: 23,
      currentStreakDays: 7,
      savedExpressionCount: 42,
    });
  });
});
