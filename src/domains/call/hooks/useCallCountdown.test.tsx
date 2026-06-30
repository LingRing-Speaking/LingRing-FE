import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CALL_CAP_MS, useCallCountdown } from "./useCallCountdown";

const WARN_REMAINING_MS = 3 * 60 * 1000;
const CLOSING_REMAINING_MS = 60 * 1000;

function setup(active: boolean, onTimeUp: () => void = () => {}) {
  return renderHook(({ active }) => useCallCountdown({ active, onTimeUp }), {
    initialProps: { active },
  });
}

describe("useCallCountdown", () => {
  afterEach(() => vi.useRealTimers());

  it("active=false 면 남은 시간은 상한(20분) 그대로이고 phase 는 calm 이다", () => {
    const { result } = setup(false);
    expect(result.current.remainingMs).toBe(CALL_CAP_MS);
    expect(result.current.phase).toBe("calm");
  });

  it("active=true 면 1초마다 남은 시간이 줄어든다", async () => {
    vi.useFakeTimers();
    const { result } = setup(true);

    await vi.advanceTimersByTimeAsync(1000);
    expect(result.current.remainingMs).toBe(CALL_CAP_MS - 1000);
  });

  it("남은 시간이 3분 이하가 되면 phase 가 warn 이다", async () => {
    vi.useFakeTimers();
    const start = new Date("2026-05-04T00:00:00Z");
    vi.setSystemTime(start);
    const { result } = setup(true);

    vi.setSystemTime(
      new Date(start.getTime() + (CALL_CAP_MS - WARN_REMAINING_MS) - 1000),
    );
    await vi.advanceTimersByTimeAsync(1000);

    expect(result.current.remainingMs).toBe(WARN_REMAINING_MS);
    expect(result.current.phase).toBe("warn");
  });

  it("남은 시간이 1분 이하가 되면 phase 가 closing 이다", async () => {
    vi.useFakeTimers();
    const start = new Date("2026-05-04T00:00:00Z");
    vi.setSystemTime(start);
    const { result } = setup(true);

    vi.setSystemTime(
      new Date(start.getTime() + (CALL_CAP_MS - CLOSING_REMAINING_MS) - 1000),
    );
    await vi.advanceTimersByTimeAsync(1000);

    expect(result.current.phase).toBe("closing");
  });

  it("남은 시간이 0 이 되면 onTimeUp 을 정확히 한 번 호출한다", async () => {
    vi.useFakeTimers();
    const start = new Date("2026-05-04T00:00:00Z");
    vi.setSystemTime(start);
    const onTimeUp = vi.fn();
    setup(true, onTimeUp);

    vi.setSystemTime(new Date(start.getTime() + CALL_CAP_MS - 1000));
    await vi.advanceTimersByTimeAsync(1000);
    expect(onTimeUp).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(5000);
    expect(onTimeUp).toHaveBeenCalledTimes(1);
  });

  it("남은 시간은 0 미만으로 내려가지 않는다", async () => {
    vi.useFakeTimers();
    const start = new Date("2026-05-04T00:00:00Z");
    vi.setSystemTime(start);
    const { result } = setup(true);

    vi.setSystemTime(new Date(start.getTime() + CALL_CAP_MS + 10000));
    await vi.advanceTimersByTimeAsync(1000);

    expect(result.current.remainingMs).toBe(0);
  });

  it("백그라운드로 throttled 되어도 wallclock 기준으로 남은 시간이 보정된다", async () => {
    vi.useFakeTimers();
    const start = new Date("2026-05-04T00:00:00Z");
    vi.setSystemTime(start);
    const { result } = setup(true);

    await vi.advanceTimersByTimeAsync(1000);
    expect(result.current.remainingMs).toBe(CALL_CAP_MS - 1000);

    // 백그라운드 시뮬: 시계만 5초 점프 (timer fire 가 throttled 된 상황)
    vi.setSystemTime(new Date(start.getTime() + 1000 + 5000));
    await vi.advanceTimersByTimeAsync(1000);
    expect(result.current.remainingMs).toBe(CALL_CAP_MS - 7000);
  });

  it("visibilitychange 로 visible 복귀 시 즉시 남은 시간이 갱신된다", async () => {
    vi.useFakeTimers();
    const start = new Date("2026-05-04T00:00:00Z");
    vi.setSystemTime(start);
    const { result } = setup(true);

    await vi.advanceTimersByTimeAsync(1000);
    vi.setSystemTime(new Date(start.getTime() + 1000 + 5000));
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(result.current.remainingMs).toBe(CALL_CAP_MS - 6000);
  });

  it("active=false 가 되면 카운트다운이 멈춘다", async () => {
    vi.useFakeTimers();
    const { result, rerender } = setup(true);

    await vi.advanceTimersByTimeAsync(3000);
    expect(result.current.remainingMs).toBe(CALL_CAP_MS - 3000);

    rerender({ active: false });
    await vi.advanceTimersByTimeAsync(5000);
    expect(result.current.remainingMs).toBe(CALL_CAP_MS - 3000);
  });
});
