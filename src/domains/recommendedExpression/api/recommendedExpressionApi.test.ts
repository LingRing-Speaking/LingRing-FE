import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "../../../../test/msw/server";
import { ApiError } from "@/lib/http";
import { fetchDailyRecommendedExpression } from "./recommendedExpressionApi";

describe("recommendedExpressionApi", () => {
  it("200 응답이면 DailyRecommendedExpression 을 반환한다", async () => {
    const result = await fetchDailyRecommendedExpression();

    expect(result).toEqual({
      id: 1,
      expression: "Sounds good to me.",
      meaning: "좋아요, 저도 동의해요 — 가볍게 맞장구칠 때",
      createdAt: "2026-04-25T08:00:00.000000",
    });
  });

  it("404 응답이면 null 을 반환한다 (throw 하지 않는다)", async () => {
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

    const result = await fetchDailyRecommendedExpression();

    expect(result).toBeNull();
  });

  it("500 응답이면 ApiError 를 throw 한다", async () => {
    server.use(
      http.get("http://localhost:3000/recommended-expressions/daily", () =>
        HttpResponse.json(
          { data: null, status: 500, message: "internal error" },
          { status: 500 },
        ),
      ),
    );

    await expect(fetchDailyRecommendedExpression()).rejects.toBeInstanceOf(
      ApiError,
    );
  });
});
