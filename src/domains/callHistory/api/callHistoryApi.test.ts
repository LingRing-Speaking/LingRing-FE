import { describe, expect, it } from "vitest";
import {
  fetchAnalysisQuota,
  fetchAnalysisResult,
  fetchAnalysisStatus,
  fetchCallHistory,
  fetchCallTranscript,
  requestAnalysis,
} from "./callHistoryApi";

describe("callHistoryApi", () => {
  it("fetchAnalysisQuota 는 freeTicket, paidTicket, nextResetAt 을 반환한다", async () => {
    const quota = await fetchAnalysisQuota();
    expect(typeof quota.freeTicket).toBe("number");
    expect(typeof quota.paidTicket).toBe("number");
    expect(typeof quota.nextResetAt).toBe("string");
  });

  it("fetchCallHistory 는 /calls?page=&size= 를 호출해 items, hasNext 를 반환한다", async () => {
    const result = await fetchCallHistory(0, 20);

    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items[0]).toMatchObject({
      id: expect.any(Number),
      partner: { id: expect.any(Number), name: expect.any(String) },
      startedAt: expect.any(String),
      durationSec: expect.any(Number),
    });
    const first = result.items[0];
    const id = first?.analysisId;
    expect(id === null || typeof id === "number").toBe(true);
    expect([
      "WAITING_RECORDINGS",
      "READY",
      "PROCESSING",
      "COMPLETED",
      "FAILED",
    ]).toContain(first?.analysisStatus);
    expect(typeof result.hasNext).toBe("boolean");
  });

  it("page 와 size 파라미터에 따라 다른 결과를 받는다", async () => {
    const first = await fetchCallHistory(0, 5);
    const second = await fetchCallHistory(1, 5);

    expect(first.items).toHaveLength(5);
    expect(second.items).toHaveLength(5);
    const firstIds = first.items.map((item) => item.id);
    const secondIds = second.items.map((item) => item.id);
    expect(firstIds.some((id) => secondIds.includes(id))).toBe(false);
  });

  it("requestAnalysis 는 POST 응답의 analysisId 를 그대로 반환한다", async () => {
    const result = await requestAnalysis(1);
    expect(typeof result.analysisId).toBe("number");
  });

  it("fetchAnalysisStatus 는 analysisId 의 status 를 반환한다", async () => {
    const { analysisId } = await requestAnalysis(2);
    const status = await fetchAnalysisStatus(analysisId);
    expect(["PROCESSING", "COMPLETED", "FAILED"]).toContain(status.status);
  });

  it("fetchAnalysisResult 는 mistakes/positives 배열을 포함한 본문을 반환한다", async () => {
    const { analysisId } = await requestAnalysis(3);
    const result = await fetchAnalysisResult(analysisId);
    expect(Array.isArray(result.mistakes)).toBe(true);
    expect(Array.isArray(result.positives)).toBe(true);
    expect(["PROCESSING", "COMPLETED", "FAILED"]).toContain(result.status);
  });

  it("fetchCallTranscript 는 /calls/{callId}/transcript 의 callId, segments 를 반환한다", async () => {
    const result = await fetchCallTranscript(42);

    expect(result.callId).toBe(42);
    expect(Array.isArray(result.segments)).toBe(true);
    expect(result.segments.length).toBeGreaterThan(0);
    expect(result.segments[0]).toMatchObject({
      userId: expect.any(Number),
      startSec: expect.any(Number),
      endSec: expect.any(Number),
      text: expect.any(String),
    });
  });
});
