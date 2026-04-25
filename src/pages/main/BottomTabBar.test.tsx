import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BottomTabBar } from "./BottomTabBar";

describe("BottomTabBar (메인)", () => {
  it("세 개의 탭 버튼을 모두 disabled 로 렌더한다", () => {
    render(<BottomTabBar />);

    expect(screen.getByRole("button", { name: /홈/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /대화 기록/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /마이페이지/ })).toBeDisabled();
  });

  it("홈 탭에 aria-current=page 가 붙는다", () => {
    render(<BottomTabBar />);

    expect(screen.getByRole("button", { name: /홈/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
