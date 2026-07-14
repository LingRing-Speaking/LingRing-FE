import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderWithQueryClient } from "../../../test/utils/renderWithQueryClient";
import { FriendRequestsPage } from "./FriendRequestsPage";

describe("FriendRequestsPage", () => {
  it("기본으로 받은 요청을 수락/거절 버튼과 함께 보여준다", async () => {
    renderWithQueryClient(<FriendRequestsPage />, { initialEntries: ["/friends/requests"] });

    expect(await screen.findByText("하늘")).toBeInTheDocument();
    expect(screen.getByText("Jenny")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "수락" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "거절" })).toHaveLength(2);
  });

  it("보낸 세그먼트로 전환하면 보낸 요청과 취소 버튼이 보인다", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<FriendRequestsPage />, { initialEntries: ["/friends/requests"] });

    await screen.findByText("하늘");
    await user.click(screen.getByRole("button", { name: "보낸" }));

    expect(await screen.findByText("준서")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "취소" })).toBeInTheDocument();
  });

  it("수락하면 그 요청이 목록에서 사라진다", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<FriendRequestsPage />, { initialEntries: ["/friends/requests"] });

    const acceptButtons = await screen.findAllByRole("button", { name: "수락" });
    expect(acceptButtons).toHaveLength(2);

    await user.click(acceptButtons[0]!);

    await waitFor(() => expect(screen.getAllByRole("button", { name: "수락" })).toHaveLength(1));
  });
});
