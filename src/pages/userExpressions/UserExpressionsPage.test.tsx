import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/mocks/server";
import { renderWithQueryClient } from "../../../test/utils/renderWithQueryClient";
import { UserExpressionsPage } from "./UserExpressionsPage";

const FAILURE = () =>
  HttpResponse.json(
    { data: null, status: 500, message: "정보를 불러오지 못했어요." },
    { status: 500 },
  );

describe("UserExpressionsPage", () => {
  it("두 쿼리가 모두 성공하면 표현 목록과 stats 기반 총 개수를 보여준다", async () => {
    renderWithQueryClient(<UserExpressionsPage />);

    await waitFor(() => {
      expect(
        screen.getByText(
          "I'd appreciate it if you could send the report by Friday.",
        ),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByText("금요일까지 보고서를 보내주시면 감사하겠습니다."),
    ).toBeInTheDocument();
    expect(screen.getByText("총 42개")).toBeInTheDocument();
  });

  it("로딩 중에는 스피너를 보여준다", () => {
    renderWithQueryClient(<UserExpressionsPage />);

    expect(screen.getByRole("status", { name: "로딩 중" })).toBeInTheDocument();
  });

  it("표현이 비어 있으면 빈 상태를 보여준다", async () => {
    server.use(
      http.get("http://localhost:3000/api/v1/expressions", () =>
        HttpResponse.json({
          data: { items: [], hasNext: false },
          status: 200,
          message: "OK",
        }),
      ),
    );

    renderWithQueryClient(<UserExpressionsPage />);

    await waitFor(() => {
      expect(
        screen.getByText("아직 저장한 표현이 없어요"),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByRole("button", { name: "통화 시작하기" }),
    ).toBeDisabled();
  });

  it("한 쿼리만 실패해도 에러 화면 + 다시 시도 버튼을 보여준다", async () => {
    server.use(http.get("http://localhost:3000/api/v1/expressions", FAILURE));

    renderWithQueryClient(<UserExpressionsPage />);

    await waitFor(() => {
      expect(
        screen.getByText("정보를 불러오지 못했어요."),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByRole("button", { name: "다시 시도" }),
    ).toBeInTheDocument();
  });

  it("다시 시도 버튼을 누르면 두 쿼리를 다시 부른다", async () => {
    const user = userEvent.setup();
    let expressionsCallCount = 0;
    let statsCallCount = 0;
    server.use(
      http.get("http://localhost:3000/api/v1/expressions", () => {
        expressionsCallCount += 1;
        if (expressionsCallCount === 1) {
          return HttpResponse.json(
            { data: null, status: 500, message: "fail" },
            { status: 500 },
          );
        }
        return HttpResponse.json({
          data: {
            items: [
              {
                id: 1,
                userId: 1,
                expression: "Just give me a second.",
                meaning: "잠깐만요.",
                createdAt: "2026-04-25T00:00:00.000000",
              },
            ],
            hasNext: false,
          },
          status: 200,
          message: "OK",
        });
      }),
      http.get("http://localhost:3000/api/v1/me/stats", ({ params }) => {
        statsCallCount += 1;
        return HttpResponse.json({
          data: {
            userId: Number(params.userId),
            level: "INTERMEDIATE",
            mannerTemperature: 36.5,
            totalCallCount: 0,
            currentStreakDays: 0,
            expressionCount: 1,
            lastStudyDate: null,
          },
          status: 200,
          message: "OK",
        });
      }),
    );

    renderWithQueryClient(<UserExpressionsPage />);

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "다시 시도" }),
      ).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: "다시 시도" }));

    await waitFor(() => {
      expect(screen.getByText("Just give me a second.")).toBeInTheDocument();
    });
    expect(screen.getByText("총 1개")).toBeInTheDocument();
    expect(expressionsCallCount).toBe(2);
    expect(statsCallCount).toBeGreaterThanOrEqual(2);
  });

  it("카드의 찜 해제(별표) 를 누르면 목록에서 제거된다", async () => {
    // GET 이 현재 목록을 반영하는 stateful 목: DELETE 후 무효화 refetch 에도 유지.
    let items = [
      { id: 1, userId: 1, expression: "첫 표현", meaning: "뜻1", createdAt: "" },
      { id: 2, userId: 1, expression: "둘째 표현", meaning: "뜻2", createdAt: "" },
    ];
    server.use(
      http.get("http://localhost:3000/api/v1/expressions", () =>
        HttpResponse.json({
          data: { items, hasNext: false },
          status: 200,
          message: "OK",
        }),
      ),
      http.delete(
        "http://localhost:3000/api/v1/expressions/:id",
        ({ params }) => {
          items = items.filter((it) => it.id !== Number(params.id));
          return HttpResponse.json({
            data: null,
            status: 204,
            message: "NO_CONTENT",
          });
        },
      ),
    );

    renderWithQueryClient(<UserExpressionsPage />);
    await waitFor(() =>
      expect(screen.getByText("첫 표현")).toBeInTheDocument(),
    );

    const stars = screen.getAllByRole("button", { name: "찜 해제" });
    await userEvent.click(stars[0]);

    await waitFor(() =>
      expect(screen.queryByText("첫 표현")).not.toBeInTheDocument(),
    );
    expect(screen.getByText("둘째 표현")).toBeInTheDocument();
  });

  it("뒤로 가기 버튼은 /mypage 로 이동하는 링크다", () => {
    renderWithQueryClient(<UserExpressionsPage />);

    expect(screen.getByRole("link", { name: "뒤로 가기" })).toHaveAttribute(
      "href",
      "/mypage",
    );
  });
});
