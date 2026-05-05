import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/mocks/server";
import { renderWithQueryClient } from "../../../test/utils/renderWithQueryClient";
import { MyPagePage } from "./MyPagePage";

const FAILURE = () =>
  HttpResponse.json(
    { data: null, status: 500, message: "정보를 불러오지 못했어요." },
    { status: 500 },
  );

describe("MyPagePage", () => {
  it("쿼리가 성공하면 프로필/주간 통계/내 기록 섹션을 모두 렌더한다", async () => {
    renderWithQueryClient(<MyPagePage />, {
      user: { id: 1, nickname: "Lee", profileImage: null },
    });

    await waitFor(() => {
      expect(screen.getByText("Lee")).toBeInTheDocument();
    });
    expect(screen.getByText("Intermediate")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("23")).toBeInTheDocument();
    expect(screen.getByText("42개")).toBeInTheDocument();
  });

  it("로딩 중에는 스피너를 보여준다", () => {
    renderWithQueryClient(<MyPagePage />);

    expect(screen.getByRole("status", { name: "로딩 중" })).toBeInTheDocument();
  });

  it("stats 가 실패하면 에러 화면 + 다시 시도 버튼을 보여준다", async () => {
    server.use(http.get("http://localhost:3000/api/v1/me/stats", FAILURE));

    renderWithQueryClient(<MyPagePage />);

    await waitFor(() => {
      expect(
        screen.getByText("정보를 불러오지 못했어요."),
      ).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeInTheDocument();
  });

  it("다시 시도 버튼을 누르면 stats 쿼리를 다시 부른다", async () => {
    const user = userEvent.setup();
    let statsCallCount = 0;
    server.use(
      http.get("http://localhost:3000/api/v1/me/stats", () => {
        statsCallCount += 1;
        if (statsCallCount === 1) {
          return HttpResponse.json(
            { data: null, status: 500, message: "fail" },
            { status: 500 },
          );
        }
        return HttpResponse.json({
          data: {
            userId: 1,
            level: "ADVANCED",
            mannerTemperature: 40,
            totalCallCount: 100,
            currentStreakDays: 14,
            expressionCount: 5,
            lastStudyDate: "2026-04-24",
          },
          status: 200,
          message: "OK",
        });
      }),
    );

    renderWithQueryClient(<MyPagePage />, {
      user: { id: 1, nickname: "Lee", profileImage: null },
    });

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "다시 시도" }),
      ).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: "다시 시도" }));

    await waitFor(() => {
      expect(screen.getByText("Advanced")).toBeInTheDocument();
    });

    expect(statsCallCount).toBe(2);
  });
});
