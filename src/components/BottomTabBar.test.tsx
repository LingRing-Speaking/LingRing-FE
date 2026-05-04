import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { BottomTabBar } from "./BottomTabBar";

function renderAt(pathname: string) {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <BottomTabBar />
    </MemoryRouter>,
  );
}

describe("BottomTabBar", () => {
  it("홈·통화 기록·마이페이지는 모두 링크다", () => {
    renderAt("/home");

    expect(screen.getByRole("link", { name: /^홈$/ })).toHaveAttribute(
      "href",
      "/home",
    );
    expect(screen.getByRole("link", { name: /통화 기록/ })).toHaveAttribute(
      "href",
      "/history",
    );
    expect(screen.getByRole("link", { name: /마이페이지/ })).toHaveAttribute(
      "href",
      "/mypage",
    );
  });

  it("/home 경로에서는 홈 탭이 활성 상태다", () => {
    renderAt("/home");

    expect(screen.getByRole("link", { name: /^홈$/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: /마이페이지/ })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("/mypage 경로에서는 마이페이지 탭이 활성 상태다", () => {
    renderAt("/mypage");

    expect(screen.getByRole("link", { name: /마이페이지/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: /^홈$/ })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("/history 경로에서는 통화 기록 탭이 활성 상태다", () => {
    renderAt("/history");

    expect(screen.getByRole("link", { name: /통화 기록/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: /^홈$/ })).not.toHaveAttribute(
      "aria-current",
    );
    expect(screen.getByRole("link", { name: /마이페이지/ })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("탭바 외 경로(/expressions)에서는 어떤 탭도 활성이 아니다", () => {
    renderAt("/expressions");

    expect(screen.getByRole("link", { name: /^홈$/ })).not.toHaveAttribute(
      "aria-current",
    );
    expect(screen.getByRole("link", { name: /마이페이지/ })).not.toHaveAttribute(
      "aria-current",
    );
  });
});
