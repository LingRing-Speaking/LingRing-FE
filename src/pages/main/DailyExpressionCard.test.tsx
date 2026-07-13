import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithQueryClient } from "../../../test/utils/renderWithQueryClient";
import { DailyExpressionCard } from "./DailyExpressionCard";

const sample = {
  id: 1,
  expression: "Sounds good to me.",
  meaning: "좋아요, 저도 동의해요",
  createdAt: "2026-04-25T08:00:00.000000",
  bookmarkId: null,
};

describe("DailyExpressionCard", () => {
  it("data 가 주어지면 expression 과 meaning 을 보여준다", () => {
    renderWithQueryClient(<DailyExpressionCard data={sample} />);

    expect(screen.getByText(/Sounds good to me/)).toBeInTheDocument();
    expect(screen.getByText("좋아요, 저도 동의해요")).toBeInTheDocument();
  });

  it("data 가 null 이면 폴백 메시지를 보여주고 별표는 없다", () => {
    renderWithQueryClient(<DailyExpressionCard data={null} />);

    expect(screen.getByText("오늘의 표현을 준비 중이에요")).toBeInTheDocument();
    expect(screen.queryByText("좋아요, 저도 동의해요")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "찜하기" }),
    ).not.toBeInTheDocument();
  });

  it("data 가 있으면 찜하기 별표를 보여준다", () => {
    renderWithQueryClient(<DailyExpressionCard data={sample} />);

    expect(
      screen.getByRole("button", { name: "찜하기" }),
    ).toBeInTheDocument();
  });

  it("이미 찜된 상태면 찜 해제 별표를 보여준다", () => {
    renderWithQueryClient(
      <DailyExpressionCard data={{ ...sample, bookmarkId: 9 }} />,
    );

    expect(
      screen.getByRole("button", { name: "찜 해제" }),
    ).toBeInTheDocument();
  });
});
