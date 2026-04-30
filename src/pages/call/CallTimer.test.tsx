import { render, screen } from "@testing-library/react";
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
});
