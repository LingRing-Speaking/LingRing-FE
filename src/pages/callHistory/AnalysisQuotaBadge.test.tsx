import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AnalysisQuotaBadge } from "./AnalysisQuotaBadge";

describe("AnalysisQuotaBadge", () => {
  it("quota 가 있으면 일반/황금 티켓 수를 노출한다", () => {
    render(
      <AnalysisQuotaBadge
        quota={{ freeTicket: 3, paidTicket: 1, nextResetAt: "2026-07-01T00:00:00" }}
      />,
    );
    const badge = screen.getByLabelText("분석 티켓 잔여");
    expect(badge).toHaveTextContent("일반티켓3장");
    expect(badge).toHaveTextContent("황금티켓1장");
  });

  it("0 장도 그대로 노출한다", () => {
    render(
      <AnalysisQuotaBadge
        quota={{ freeTicket: 0, paidTicket: 0, nextResetAt: "2026-07-01T00:00:00" }}
      />,
    );
    const badge = screen.getByLabelText("분석 티켓 잔여");
    expect(badge).toHaveTextContent("일반티켓0장");
    expect(badge).toHaveTextContent("황금티켓0장");
  });

  it("quota 가 없으면(로딩·오류) 수치 대신 스켈레톤만 둔다", () => {
    render(<AnalysisQuotaBadge quota={undefined} />);
    expect(screen.queryByLabelText("분석 티켓 잔여")).not.toBeInTheDocument();
    expect(screen.queryByText(/일반티켓/)).not.toBeInTheDocument();
  });
});
