import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/mocks/server";
import { renderWithQueryClient } from "../../../test/utils/renderWithQueryClient";
import { BlockListPage } from "./BlockListPage";

const mockBlockList = (items: unknown[], hasNext = false) =>
  server.use(
    http.get("http://localhost:3000/api/v1/blocks", () =>
      HttpResponse.json({
        data: { items, hasNext },
        status: 200,
        message: "OK",
      }),
    ),
  );

describe("BlockListPage", () => {
  it("성공 시 차단된 사용자 닉네임을 렌더한다", async () => {
    mockBlockList([
      {
        id: 1,
        userId: 1,
        blockedUserId: 7,
        nickname: "Sophie",
        profileImage: null,
        createdAt: "2026-05-10T12:00:00",
      },
    ]);

    renderWithQueryClient(<BlockListPage />);

    expect(
      await screen.findByRole("heading", { level: 1, name: "차단한 사용자" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("Sophie")).toBeInTheDocument();
  });

  it("빈 응답이면 EmptyBlockList 노출", async () => {
    mockBlockList([]);

    renderWithQueryClient(<BlockListPage />);

    expect(await screen.findByText("아직 차단한 사용자가 없어요")).toBeInTheDocument();
  });

  it("에러 시 다시 시도 버튼이 노출되고 클릭하면 refetch 한다", async () => {
    let attempts = 0;
    server.use(
      http.get("http://localhost:3000/api/v1/blocks", () => {
        attempts += 1;
        if (attempts === 1) {
          return new HttpResponse(null, { status: 500 });
        }
        return HttpResponse.json({
          data: {
            items: [
              {
                id: 1,
                userId: 1,
                blockedUserId: 7,
                nickname: "Retry",
                profileImage: null,
                createdAt: "2026-05-10T12:00:00",
              },
            ],
            hasNext: false,
          },
          status: 200,
          message: "OK",
        });
      }),
    );

    renderWithQueryClient(<BlockListPage />);

    const retry = await screen.findByRole("button", { name: /다시 시도/ });
    await userEvent.click(retry);

    expect(await screen.findByText("Retry")).toBeInTheDocument();
  });

  it("[해제] 클릭 시 해제 확인 모달이 노출된다", async () => {
    mockBlockList([
      {
        id: 1,
        userId: 1,
        blockedUserId: 7,
        nickname: "Sophie",
        profileImage: null,
        createdAt: "2026-05-10T12:00:00",
      },
    ]);

    renderWithQueryClient(<BlockListPage />);

    await screen.findByText("Sophie");
    await userEvent.click(screen.getByRole("button", { name: "해제" }));

    expect(await screen.findByText("Sophie님의 차단을 해제할까요?")).toBeInTheDocument();
  });

  it("[해제] → 모달의 [해제] 확정 시 해제 모달이 닫힌다", async () => {
    mockBlockList([
      {
        id: 1,
        userId: 1,
        blockedUserId: 7,
        nickname: "Sophie",
        profileImage: null,
        createdAt: "2026-05-10T12:00:00",
      },
    ]);

    renderWithQueryClient(<BlockListPage />);

    await screen.findByText("Sophie");
    await userEvent.click(screen.getByRole("button", { name: "해제" }));

    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "해제" }));

    await waitFor(() =>
      expect(screen.queryByText("Sophie님의 차단을 해제할까요?")).not.toBeInTheDocument(),
    );
  });
});
