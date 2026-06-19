import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useConfirmCountdown } from "./useConfirmCountdown";

describe("useConfirmCountdown", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("deadline 이 null 이면 remainingMs 는 null", () => {
    const { result } = renderHook(() => useConfirmCountdown(null));
    expect(result.current.remainingMs).toBeNull();
    expect(result.current.expired).toBe(false);
  });

  it("미래 deadline 이면 양수 remainingMs 를 반환한다", () => {
    const deadline = new Date(Date.now() + 10_000).toISOString();
    const { result } = renderHook(() => useConfirmCountdown(deadline));
    expect(result.current.remainingMs).toBeGreaterThan(0);
    expect(result.current.expired).toBe(false);
  });

  it("과거 deadline 이면 expired=true, remainingMs=0", () => {
    const deadline = new Date(Date.now() - 1000).toISOString();
    const { result } = renderHook(() => useConfirmCountdown(deadline));
    expect(result.current.remainingMs).toBe(0);
    expect(result.current.expired).toBe(true);
  });

  it("시간이 흐르면 remainingMs 가 감소한다", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const deadline = new Date(Date.now() + 5000).toISOString();
    const { result } = renderHook(() => useConfirmCountdown(deadline));

    const initial = result.current.remainingMs ?? 0;
    await vi.advanceTimersByTimeAsync(1000);
    await waitFor(() => {
      expect(result.current.remainingMs).toBeLessThan(initial);
    });
  });
});
