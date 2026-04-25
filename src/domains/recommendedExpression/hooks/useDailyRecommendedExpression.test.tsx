import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { server } from "../../../../test/msw/server";
import { createTestQueryClient } from "../../../../test/utils/renderWithQueryClient";
import { useDailyRecommendedExpression } from "./useDailyRecommendedExpression";

const wrapper = ({ children }: { children: ReactNode }) => {
  const queryClient = createTestQueryClient();
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useDailyRecommendedExpression", () => {
  it("성공 시 표현 객체를 data 로 반환한다", async () => {
    const { result } = renderHook(() => useDailyRecommendedExpression(), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({
      id: 1,
      expression: "Sounds good to me.",
      meaning: "좋아요, 저도 동의해요 — 가볍게 맞장구칠 때",
      createdAt: "2026-04-25T08:00:00.000000",
    });
  });

  it("404 응답 시 data 가 null 이고 isError 는 false 다", async () => {
    server.use(
      http.get("http://localhost:3000/recommended-expressions/daily", () =>
        HttpResponse.json(
          {
            data: null,
            status: 404,
            message: "RECOMMENDED_EXPRESSION_NOT_FOUND",
          },
          { status: 404 },
        ),
      ),
    );

    const { result } = renderHook(() => useDailyRecommendedExpression(), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
    expect(result.current.isError).toBe(false);
  });

  it("500 응답 시 isError 가 true 다", async () => {
    server.use(
      http.get("http://localhost:3000/recommended-expressions/daily", () =>
        HttpResponse.json(
          { data: null, status: 500, message: "internal error" },
          { status: 500 },
        ),
      ),
    );

    const { result } = renderHook(() => useDailyRecommendedExpression(), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
