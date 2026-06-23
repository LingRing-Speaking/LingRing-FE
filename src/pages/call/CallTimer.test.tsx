import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CallTimer } from "./CallTimer";

const MIN = 60 * 1000;

describe("CallTimer", () => {
  it("남은 시간을 MM:SS 로 표시한다", () => {
    render(<CallTimer remainingMs={20 * MIN} phase="calm" />);
    expect(screen.getByText("20:00")).toBeInTheDocument();
  });

  it("초 단위는 올림으로 표시한다 (0.5초 남아도 00:01)", () => {
    render(<CallTimer remainingMs={500} phase="closing" />);
    expect(screen.getByText("00:01")).toBeInTheDocument();
  });

  it("0ms 면 00:00 이다", () => {
    render(<CallTimer remainingMs={0} phase="closing" />);
    expect(screen.getByText("00:00")).toBeInTheDocument();
  });

  it("phase 를 data-phase 로 노출한다", () => {
    const { rerender } = render(<CallTimer remainingMs={MIN} phase="calm" />);
    expect(screen.getByLabelText("남은 통화 시간")).toHaveAttribute(
      "data-phase",
      "calm",
    );

    rerender(<CallTimer remainingMs={MIN} phase="warn" />);
    expect(screen.getByLabelText("남은 통화 시간")).toHaveAttribute(
      "data-phase",
      "warn",
    );

    rerender(<CallTimer remainingMs={MIN} phase="closing" />);
    expect(screen.getByLabelText("남은 통화 시간")).toHaveAttribute(
      "data-phase",
      "closing",
    );
  });

  it("calm 은 회색, warn/closing 은 코랄로 표시한다", () => {
    const { rerender } = render(<CallTimer remainingMs={MIN} phase="calm" />);
    expect(screen.getByLabelText("남은 통화 시간").className).toMatch(/text-gray-900/);

    rerender(<CallTimer remainingMs={MIN} phase="warn" />);
    expect(screen.getByLabelText("남은 통화 시간").className).toMatch(/text-coral-600/);

    rerender(<CallTimer remainingMs={MIN} phase="closing" />);
    expect(screen.getByLabelText("남은 통화 시간").className).toMatch(/text-coral-600/);
  });
});
