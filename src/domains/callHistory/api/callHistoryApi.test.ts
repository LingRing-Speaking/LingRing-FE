import { describe, expect, it } from "vitest";
import { fetchCallHistory } from "./callHistoryApi";

describe("callHistoryApi", () => {
  it("fetchCallHistory 는 /calls?page=&size= 를 호출해 items, hasNext 를 반환한다", async () => {
    const result = await fetchCallHistory(0, 20);

    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items[0]).toMatchObject({
      id: expect.any(Number),
      partner: { id: expect.any(Number), name: expect.any(String) },
      startedAt: expect.any(String),
      durationSec: expect.any(Number),
    });
    expect([null, "IN_PROGRESS", "COMPLETED"]).toContain(
      result.items[0]?.analysisStatus,
    );
    expect(typeof result.hasNext).toBe("boolean");
  });

  it("page 와 size 파라미터에 따라 다른 결과를 받는다", async () => {
    const first = await fetchCallHistory(0, 5);
    const second = await fetchCallHistory(1, 5);

    expect(first.items).toHaveLength(5);
    expect(second.items).toHaveLength(5);
    expect(first.items[0]?.id).toBeDefined();
    expect(second.items[0]?.id).toBeDefined();
    const firstIds = first.items.map((item) => item.id);
    const secondIds = second.items.map((item) => item.id);
    expect(firstIds.some((id) => secondIds.includes(id))).toBe(false);
  });
});
