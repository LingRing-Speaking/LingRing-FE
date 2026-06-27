import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CallHistoryItem } from "../types";
import { usePollTransientCalls } from "./usePollTransientCalls";

function makeItem(
  id: number,
  status: CallHistoryItem["analysisStatus"],
): CallHistoryItem {
  return {
    id,
    partner: { id: 1000 + id, name: `P${id}`, profileImage: null },
    startedAt: "2026-05-21T19:00:00+09:00",
    durationSec: 120,
    analysisId:
      status === "READY" || status === "WAITING_RECORDINGS" ? null : 100 + id,
    analysisStatus: status,
  };
}

function buildWrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("usePollTransientCalls", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("PROCESSING 카드가 하나도 없으면 ['calls'] invalidate 가 호출되지 않는다", () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    renderHook(
      () =>
        usePollTransientCalls([
          makeItem(1, "READY"),
          makeItem(2, "COMPLETED"),
          makeItem(3, "FAILED"),
        ]),
      { wrapper: buildWrapper(queryClient) },
    );

    vi.advanceTimersByTime(10_000);
    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it("PROCESSING 카드가 있으면 일정 주기로 ['calls'] 가 invalidate 된다", () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    renderHook(
      () =>
        usePollTransientCalls([
          makeItem(1, "PROCESSING"),
          makeItem(2, "COMPLETED"),
        ]),
      { wrapper: buildWrapper(queryClient) },
    );

    vi.advanceTimersByTime(3000);
    expect(invalidateSpy).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenLastCalledWith({ queryKey: ["calls"] });

    vi.advanceTimersByTime(3000);
    expect(invalidateSpy).toHaveBeenCalledTimes(2);
  });

  it("WAITING_RECORDINGS(녹음 업로드 중) 카드가 있으면 일정 주기로 ['calls'] 가 invalidate 된다", () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    renderHook(
      () =>
        usePollTransientCalls([
          makeItem(1, "WAITING_RECORDINGS"),
          makeItem(2, "READY"),
        ]),
      { wrapper: buildWrapper(queryClient) },
    );

    vi.advanceTimersByTime(3000);
    expect(invalidateSpy).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenLastCalledWith({ queryKey: ["calls"] });
  });

  it("PROCESSING 이 모두 종료 상태로 바뀌면 다음 주기부터 invalidate 가 멈춘다", () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { rerender } = renderHook(
      ({ items }: { items: CallHistoryItem[] }) =>
        usePollTransientCalls(items),
      {
        wrapper: buildWrapper(queryClient),
        initialProps: { items: [makeItem(1, "PROCESSING")] },
      },
    );

    vi.advanceTimersByTime(3000);
    expect(invalidateSpy).toHaveBeenCalledTimes(1);

    // 분석이 끝나 COMPLETED 로 전환됨.
    rerender({ items: [makeItem(1, "COMPLETED")] });

    vi.advanceTimersByTime(10_000);
    // 더 이상 호출되지 않는다.
    expect(invalidateSpy).toHaveBeenCalledTimes(1);
  });
});
