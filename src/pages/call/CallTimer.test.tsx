import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CallTimer } from "./CallTimer";

describe("CallTimer", () => {
  afterEach(() => vi.useRealTimers());

  it("초기 렌더는 00:00 이다", () => {
    render(<CallTimer active={false} />);
    expect(screen.getByText("00:00")).toBeInTheDocument();
  });

  it("active=true 면 1초마다 카운트가 올라간다", async () => {
    vi.useFakeTimers();
    render(<CallTimer active={true} />);

    await vi.advanceTimersByTimeAsync(1000);
    expect(screen.getByText(/00.*01/)).toBeInTheDocument();

    await vi.advanceTimersByTimeAsync(59000);
    expect(screen.getByText(/01.*00/)).toBeInTheDocument();
  });

  it("active=false 면 카운트가 멈춘다", async () => {
    vi.useFakeTimers();
    const { rerender } = render(<CallTimer active={true} />);

    await vi.advanceTimersByTimeAsync(3000);
    expect(screen.getByText(/00.*03/)).toBeInTheDocument();

    rerender(<CallTimer active={false} />);
    await vi.advanceTimersByTimeAsync(5000);

    expect(screen.getByText(/00.*03/)).toBeInTheDocument();
  });

  it("백그라운드로 timer가 throttled 되어도 wallclock 기준으로 누적 시간이 보정된다", async () => {
    vi.useFakeTimers();
    const start = new Date("2026-05-04T00:00:00Z");
    vi.setSystemTime(start);

    render(<CallTimer active={true} />);

    await vi.advanceTimersByTimeAsync(1000);
    expect(screen.getByText("00:01")).toBeInTheDocument();

    // 백그라운드 시뮬: 시계만 5초 점프 (timer fire는 throttled되어 일어나지 않은 상황)
    vi.setSystemTime(new Date(start.getTime() + 1000 + 5000));

    // 다음 tick에서 wallclock 기준 누적 시간이 반영되어야 함 (1 + 5 + 1 = 7초)
    await vi.advanceTimersByTimeAsync(1000);
    expect(screen.getByText("00:07")).toBeInTheDocument();
  });

  it("visibilitychange 로 visible 복귀 시 즉시 시간이 갱신된다", async () => {
    vi.useFakeTimers();
    const start = new Date("2026-05-04T00:00:00Z");
    vi.setSystemTime(start);

    render(<CallTimer active={true} />);

    await vi.advanceTimersByTimeAsync(1000);
    expect(screen.getByText("00:01")).toBeInTheDocument();

    // 백그라운드 시뮬: 시계만 5초 점프
    vi.setSystemTime(new Date(start.getTime() + 1000 + 5000));

    // 다음 tick 기다리지 않고 visibilitychange 발화 → 즉시 6초 반영
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(screen.getByText("00:06")).toBeInTheDocument();
  });
});
