import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CountdownWarningToast } from "./CountdownWarningToast";

describe("CountdownWarningToast", () => {
  afterEach(() => vi.useRealTimers());

  it("calm 단계에서는 아무것도 보이지 않는다", () => {
    render(<CountdownWarningToast phase="calm" />);
    expect(screen.queryByText(/자동으로 끝나요/)).not.toBeInTheDocument();
  });

  it("warn 단계가 되면 경고 토스트를 보여준다", () => {
    const { rerender } = render(<CountdownWarningToast phase="calm" />);
    rerender(<CountdownWarningToast phase="warn" />);
    expect(screen.getByText("3분 뒤 통화가 자동으로 끝나요")).toBeInTheDocument();
  });

  it("일정 시간이 지나면 자동으로 사라진다", async () => {
    vi.useFakeTimers();
    const { rerender } = render(<CountdownWarningToast phase="calm" />);
    rerender(<CountdownWarningToast phase="warn" />);
    expect(screen.getByText(/자동으로 끝나요/)).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });
    expect(screen.queryByText(/자동으로 끝나요/)).not.toBeInTheDocument();
  });

  it("한 번 보여준 뒤에는 closing 단계가 되어도 다시 뜨지 않는다", async () => {
    vi.useFakeTimers();
    const { rerender } = render(<CountdownWarningToast phase="warn" />);
    expect(screen.getByText(/자동으로 끝나요/)).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });
    expect(screen.queryByText(/자동으로 끝나요/)).not.toBeInTheDocument();

    rerender(<CountdownWarningToast phase="closing" />);
    expect(screen.queryByText(/자동으로 끝나요/)).not.toBeInTheDocument();
  });
});
