import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BottomTabBar } from "./BottomTabBar";

describe("BottomTabBar", () => {
  it("세 개의 탭을 보여주고 마이페이지가 활성 상태다", () => {
    render(<BottomTabBar />);

    const mypage = screen.getByRole("button", { name: "마이페이지" });
    expect(mypage).toHaveAttribute("aria-current", "page");
  });

  it("홈과 대화 기록 버튼은 disabled 이다", () => {
    render(<BottomTabBar />);

    expect(screen.getByRole("button", { name: "홈" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "대화 기록" })).toBeDisabled();
  });
});
