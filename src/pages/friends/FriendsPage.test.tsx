import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/mocks/server";
import { renderWithQueryClient } from "../../../test/utils/renderWithQueryClient";
import { FriendsPage } from "./FriendsPage";

const FRIENDS_URL = "http://localhost:3000/api/v1/friends";

function emptyFriends() {
  server.use(
    http.get(FRIENDS_URL, () =>
      HttpResponse.json({ data: { items: [], hasNext: false }, status: 200, message: "OK" }),
    ),
  );
}

describe("FriendsPage", () => {
  it("친구 목록을 렌더한다", async () => {
    renderWithQueryClient(<FriendsPage />, { initialEntries: ["/friends"] });

    expect(await screen.findByText("지우")).toBeInTheDocument();
    expect(screen.getByText("민지")).toBeInTheDocument();
  });

  it("받은 요청이 있으면 요청 카드를 보여준다", async () => {
    renderWithQueryClient(<FriendsPage />, { initialEntries: ["/friends"] });

    expect(await screen.findByText("👥 친구 요청")).toBeInTheDocument();
  });

  it("친구가 없고 받은 요청만 있으면 빈 상태와 요청 카드가 함께 나온다", async () => {
    emptyFriends();
    renderWithQueryClient(<FriendsPage />, { initialEntries: ["/friends"] });

    expect(await screen.findByText("아직 친구가 없어요")).toBeInTheDocument();
    expect(screen.getByText("👥 친구 요청")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "친구 찾기" })).toBeInTheDocument();
  });

  it("친구도 받은 요청도 없지만 보낸 요청이 있으면 요청 카드로 진입할 수 있다", async () => {
    // 친구·받은 요청은 0, 보낸 요청만 존재 → 카드가 떠서 보낸 요청을 확인할 수 있어야 한다.
    server.use(
      http.get("http://localhost:3000/api/v1/friends/received-count", () =>
        HttpResponse.json({ data: { count: 0 }, status: 200, message: "OK" }),
      ),
      http.get(FRIENDS_URL, ({ request }) => {
        const url = new URL(request.url);
        if (
          url.searchParams.get("status") === "PENDING" &&
          url.searchParams.get("direction") === "SENT"
        ) {
          return HttpResponse.json({
            data: {
              items: [
                {
                  userId: 7,
                  nickname: "준서",
                  profileImage: null,
                  status: "PENDING",
                  direction: "SENT",
                  requestedAt: "2026-07-12T08:00:00",
                },
              ],
              hasNext: false,
            },
            status: 200,
            message: "OK",
          });
        }
        return HttpResponse.json({
          data: { items: [], hasNext: false },
          status: 200,
          message: "OK",
        });
      }),
    );
    renderWithQueryClient(<FriendsPage />, { initialEntries: ["/friends"] });

    expect(await screen.findByText("아직 친구가 없어요")).toBeInTheDocument();
    expect(screen.getByText("👥 친구 요청")).toBeInTheDocument();
  });

  it("친구 행을 누르면 프로필 모달이 열리고 삭제 액션이 있다", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<FriendsPage />, { initialEntries: ["/friends"] });

    // 통화 버튼("지우에게 통화 걸기")과의 모호성을 피해 행 내부 닉네임 텍스트를 클릭한다
    await user.click(await screen.findByText("지우"));

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "친구 삭제" })).toBeInTheDocument();
  });

  it("친구 삭제 → 확인 모달이 뜬다", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<FriendsPage />, { initialEntries: ["/friends"] });

    // 통화 버튼("지우에게 통화 걸기")과의 모호성을 피해 행 내부 닉네임 텍스트를 클릭한다
    await user.click(await screen.findByText("지우"));
    await user.click(await screen.findByRole("button", { name: "친구 삭제" }));

    expect(await screen.findByText("친구를 삭제할까요?")).toBeInTheDocument();
  });
});
