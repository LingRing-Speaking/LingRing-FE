import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WeeklyStats } from "./WeeklyStats";

describe("WeeklyStats", () => {
  it("연속 학습일과 누적 통화 수를 각각 표시한다", () => {
    render(<WeeklyStats currentStreakDays={7} totalCallCount={23} />);

    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("일")).toBeInTheDocument();
    expect(screen.getByText("23")).toBeInTheDocument();
    expect(screen.getByText("회")).toBeInTheDocument();
    expect(screen.getByText("연속 학습")).toBeInTheDocument();
    expect(screen.getByText("누적 통화")).toBeInTheDocument();
  });
});
