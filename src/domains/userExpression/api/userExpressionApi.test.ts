import { describe, expect, it } from "vitest";
import { fetchUserExpressions } from "./userExpressionApi";

describe("userExpressionApi", () => {
  it("fetchUserExpressions 는 /expressions 를 호출해 items, hasNext 를 반환한다", async () => {
    const result = await fetchUserExpressions(0, 20);

    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items[0]).toMatchObject({
      userId: 1,
      expression: expect.any(String),
      meaning: expect.any(String),
    });
    expect(typeof result.hasNext).toBe("boolean");
  });
});
