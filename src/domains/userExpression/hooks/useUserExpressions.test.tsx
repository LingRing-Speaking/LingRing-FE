import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { server } from "@/mocks/server";
import { createTestQueryClient } from "../../../../test/utils/renderWithQueryClient";
import { useUserExpressions } from "./useUserExpressions";

const wrapper = ({ children }: { children: ReactNode }) => {
  const queryClient = createTestQueryClient();
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useUserExpressions", () => {
  it("첫 페이지 성공 시 pages[0].items 를 반환한다", async () => {
    const { result } = renderHook(() => useUserExpressions(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.pages[0]?.items.length).toBeGreaterThan(0);
  });

  it("hasNext 가 false 면 hasNextPage 도 false 다", async () => {
    server.use(
      http.get("http://localhost:3000/api/v1/me/expressions", () =>
        HttpResponse.json({
          data: { items: [], hasNext: false },
          status: 200,
          message: "OK",
        }),
      ),
    );

    const { result } = renderHook(() => useUserExpressions(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(false);
  });

  it("fetchNextPage 를 호출하면 두 번째 페이지가 추가된다", async () => {
    server.use(
      http.get("http://localhost:3000/api/v1/me/expressions", ({ request }) => {
        const page = Number(new URL(request.url).searchParams.get("page"));
        return HttpResponse.json({
          data: {
            items: [
              {
                id: page + 1,
                userId: 1,
                expression: `expression-${page}`,
                meaning: `meaning-${page}`,
                createdAt: "2026-04-25T12:00:00",
              },
            ],
            hasNext: page === 0,
          },
          status: 200,
          message: "OK",
        });
      }),
    );

    const { result } = renderHook(() => useUserExpressions(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(true);

    await result.current.fetchNextPage();

    await waitFor(() => expect(result.current.data?.pages.length).toBe(2));
    expect(result.current.hasNextPage).toBe(false);
  });
});
