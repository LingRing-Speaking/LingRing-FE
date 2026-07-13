import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithQueryClient } from "../../test/utils/renderWithQueryClient";
import { BottomTabBar } from "./BottomTabBar";

function renderAt(pathname: string) {
  return renderWithQueryClient(<BottomTabBar />, { initialEntries: [pathname] });
}

describe("BottomTabBar", () => {
  it("홈·친구·통화 기록·마이페이지는 모두 링크다", () => {
    renderAt("/home");

    expect(screen.getByRole("link", { name: /^홈$/ })).toHaveAttribute("href", "/home");
    expect(screen.getByRole("link", { name: /친구/ })).toHaveAttribute("href", "/friends");
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

  it("/friends 경로에서는 친구 탭이 활성 상태다", () => {
    renderAt("/friends");

    expect(screen.getByRole("link", { name: /친구/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: /^홈$/ })).not.toHaveAttribute(
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
    expect(screen.getByRole("link", { name: /친구/ })).not.toHaveAttribute("aria-current");
  });

  it("탭바 외 경로(/expressions)에서는 어떤 탭도 활성이 아니다", () => {
    renderAt("/expressions");

    expect(screen.getByRole("link", { name: /^홈$/ })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: /친구/ })).not.toHaveAttribute("aria-current");
  });

  it("받은 친구 요청이 있으면 친구 탭에 개수 뱃지가 뜬다", async () => {
    renderAt("/home");

    // 시드에 받은 요청 2건 → 뱃지 "2"
    await waitFor(() => expect(screen.getByText("2")).toBeInTheDocument());
  });
});
