import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderWithQueryClient } from "../../../test/utils/renderWithQueryClient";
import { FriendSearchPage } from "./FriendSearchPage";

function renderPage() {
  return renderWithQueryClient(<FriendSearchPage />, { initialEntries: ["/friends/search"] });
}

describe("FriendSearchPage", () => {
  it("검색 전에는 안내 문구를 보여준다", () => {
    renderPage();
    expect(screen.getByText("닉네임으로 친구를 찾아보세요")).toBeInTheDocument();
  });

  it("관계 없는 유저를 검색하면 [친구 추가] 버튼이 뜬다", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByRole("textbox", { name: "닉네임 검색" }), "지훈{Enter}");

    expect(await screen.findByRole("button", { name: "친구 추가" })).toBeInTheDocument();
  });

  it("일치하는 유저가 없으면 '찾을 수 없어요'를 보여준다", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByRole("textbox", { name: "닉네임 검색" }), "없는유저{Enter}");

    expect(await screen.findByText("'없는유저'님을 찾을 수 없어요")).toBeInTheDocument();
  });

  it("본인을 검색하면 (나) 로 표시하고 액션 버튼이 없다", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByRole("textbox", { name: "닉네임 검색" }), "lee-tiger-1234{Enter}");

    expect(await screen.findByText("(나)")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "친구 추가" })).not.toBeInTheDocument();
  });

  it("[친구 추가] 를 누르면 '요청됨'으로 바뀐다", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByRole("textbox", { name: "닉네임 검색" }), "지훈{Enter}");
    await user.click(await screen.findByRole("button", { name: "친구 추가" }));

    expect(await screen.findByText("요청됨")).toBeInTheDocument();
  });
});
