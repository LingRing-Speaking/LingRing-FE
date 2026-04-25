import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DailyExpressionCard } from "./DailyExpressionCard";

const sample = {
  id: 1,
  expression: "Sounds good to me.",
  meaning: "좋아요, 저도 동의해요",
  createdAt: "2026-04-25T08:00:00.000000",
};

describe("DailyExpressionCard", () => {
  it("data 가 주어지면 expression 과 meaning 을 보여준다", () => {
    render(<DailyExpressionCard data={sample} />);

    expect(screen.getByText(/Sounds good to me/)).toBeInTheDocument();
    expect(screen.getByText("좋아요, 저도 동의해요")).toBeInTheDocument();
  });

  it("data 가 null 이면 폴백 메시지를 보여준다", () => {
    render(<DailyExpressionCard data={null} />);

    expect(screen.getByText("오늘의 표현을 준비 중이에요")).toBeInTheDocument();
    expect(screen.queryByText("좋아요, 저도 동의해요")).not.toBeInTheDocument();
  });

  it("카드는 disabled 상태의 button 이다", () => {
    render(<DailyExpressionCard data={sample} />);

    const card = screen.getByRole("button", {
      name: "오늘의 표현 자세히 보기",
    });
    expect(card).toBeDisabled();
  });
});
