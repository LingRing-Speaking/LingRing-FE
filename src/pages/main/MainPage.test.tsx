import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/mocks/server";
import { renderWithQueryClient } from "../../../test/utils/renderWithQueryClient";
import { MainPage } from "./MainPage";

const ERROR_RESPONSE = () =>
  HttpResponse.json(
    { data: null, status: 500, message: "정보를 불러오지 못했어요." },
    { status: 500 },
  );

const NOT_FOUND_RESPONSE = () =>
  HttpResponse.json(
    {
      data: null,
      status: 404,
      message: "RECOMMENDED_EXPRESSION_NOT_FOUND",
    },
    { status: 404 },
  );

describe("MainPage", () => {
  it("두 쿼리가 모두 성공하면 이름·표현·통화 시작 버튼을 모두 렌더한다", async () => {
    renderWithQueryClient(<MainPage />);

    await waitFor(() => expect(screen.getByText("Lee")).toBeInTheDocument());
    expect(screen.getByText(/Sounds good to me/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "통화 시작하기" }),
    ).toBeInTheDocument();
  });

  it("표현 API 가 404 이면 카드 자리에 폴백 메시지를 보여주고, greeting·통화 버튼은 그대로다", async () => {
    server.use(
      http.get(
        "http://localhost:3000/recommended-expressions/daily",
        NOT_FOUND_RESPONSE,
      ),
    );

    renderWithQueryClient(<MainPage />);

    await waitFor(() =>
      expect(
        screen.getByText("오늘의 표현을 준비 중이에요"),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText("Lee")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "통화 시작하기" }),
    ).toBeInTheDocument();
  });

  it("userMy 가 5xx 이면 전체 에러 화면 + 다시 시도 버튼을 보여준다", async () => {
    server.use(
      http.get("http://localhost:3000/users/1/my", ERROR_RESPONSE),
    );

    renderWithQueryClient(<MainPage />);

    await waitFor(() =>
      expect(
        screen.getByText("정보를 불러오지 못했어요."),
      ).toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeInTheDocument();
  });

  it("표현 API 가 5xx 이면 전체 에러 화면을 보여준다", async () => {
    server.use(
      http.get(
        "http://localhost:3000/recommended-expressions/daily",
        ERROR_RESPONSE,
      ),
    );

    renderWithQueryClient(<MainPage />);

    await waitFor(() =>
      expect(
        screen.getByText("정보를 불러오지 못했어요."),
      ).toBeInTheDocument(),
    );
  });

  it("로딩 중에는 스피너를 보여준다", () => {
    renderWithQueryClient(<MainPage />);

    expect(screen.getByRole("status", { name: "로딩 중" })).toBeInTheDocument();
  });

  it("다시 시도 버튼을 누르면 두 쿼리를 다시 부른다", async () => {
    const user = userEvent.setup();
    let myCallCount = 0;
    let dailyCallCount = 0;

    server.use(
      http.get("http://localhost:3000/users/1/my", ({ params }) => {
        myCallCount += 1;
        return HttpResponse.json({
          data: { id: Number(params.userId), name: "Lee" },
          status: 200,
          message: "OK",
        });
      }),
      http.get("http://localhost:3000/recommended-expressions/daily", () => {
        dailyCallCount += 1;
        if (dailyCallCount === 1) {
          return HttpResponse.json(
            { data: null, status: 500, message: "fail" },
            { status: 500 },
          );
        }
        return HttpResponse.json({
          data: {
            id: 1,
            expression: "Sounds good to me.",
            meaning: "좋아요",
            createdAt: "2026-04-25T08:00:00.000000",
          },
          status: 200,
          message: "OK",
        });
      }),
    );

    renderWithQueryClient(<MainPage />);

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "다시 시도" }),
      ).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: "다시 시도" }));

    await waitFor(() =>
      expect(screen.getByText(/Sounds good to me/)).toBeInTheDocument(),
    );

    expect(myCallCount).toBeGreaterThanOrEqual(2);
    expect(dailyCallCount).toBe(2);
  });

  it("표현 카드는 disabled 이고, 하단 탭의 홈은 활성 상태다", async () => {
    renderWithQueryClient(<MainPage />, { initialEntries: ["/home"] });

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "오늘의 표현 자세히 보기" }),
      ).toBeDisabled(),
    );
    expect(screen.getByRole("link", { name: /^홈$/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
