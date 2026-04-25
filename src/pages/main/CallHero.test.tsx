import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CallHero } from "./CallHero";

describe("CallHero", () => {
  it("힌트 문구 두 줄과 통화 시작 버튼을 렌더한다", () => {
    render(<CallHero />);

    expect(
      screen.getByText("오늘은 누구와 만나게 될까요?"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("버튼을 눌러 랜덤 매칭을 시작해요"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "통화 시작하기" }),
    ).toBeInTheDocument();
  });

  it("통화 시작 버튼은 disabled 다", () => {
    render(<CallHero />);

    expect(
      screen.getByRole("button", { name: "통화 시작하기" }),
    ).toBeDisabled();
  });
});
