import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyExpressions } from "./EmptyExpressions";

describe("EmptyExpressions", () => {
  it("제목과 안내 문구를 보여준다", () => {
    render(<EmptyExpressions />);

    expect(screen.getByText("아직 저장한 표현이 없어요")).toBeInTheDocument();
    expect(
      screen.getByText("통화 후 마음에 든 표현을 저장해보세요"),
    ).toBeInTheDocument();
  });

  it("통화 시작하기 버튼은 disabled 다", () => {
    render(<EmptyExpressions />);

    expect(
      screen.getByRole("button", { name: "통화 시작하기" }),
    ).toBeDisabled();
  });
});
