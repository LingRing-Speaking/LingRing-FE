import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "@/mocks/server";
import { createTestQueryClient } from "../../../../test/utils/renderWithQueryClient";
import {
  todayKstDateString,
  useDailyRecommendedExpression,
} from "./useDailyRecommendedExpression";

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
      bookmarkId: null,
    });
  });

  it("404 응답 시 data 가 null 이고 isError 는 false 다", async () => {
    server.use(
      http.get("http://localhost:3000/api/v1/recommended-expressions/daily", () =>
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
      http.get("http://localhost:3000/api/v1/recommended-expressions/daily", () =>
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

describe("todayKstDateString", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("UTC 와 KST 의 시차(+9h)를 반영해 KST 날짜 문자열을 반환한다", () => {
    // 2026-04-25 18:00 KST == 2026-04-25 09:00 UTC
    vi.setSystemTime(new Date("2026-04-25T09:00:00Z"));

    expect(todayKstDateString()).toBe("2026-04-25");
  });

  it("KST 자정 직전(23:59) 에는 그날 날짜를 반환한다", () => {
    // 2026-04-25 23:59 KST == 2026-04-25 14:59 UTC
    vi.setSystemTime(new Date("2026-04-25T14:59:00Z"));

    expect(todayKstDateString()).toBe("2026-04-25");
  });

  it("KST 자정 직후(00:01) 에는 다음 날짜를 반환한다", () => {
    // 2026-04-26 00:01 KST == 2026-04-25 15:01 UTC
    vi.setSystemTime(new Date("2026-04-25T15:01:00Z"));

    expect(todayKstDateString()).toBe("2026-04-26");
  });
});
