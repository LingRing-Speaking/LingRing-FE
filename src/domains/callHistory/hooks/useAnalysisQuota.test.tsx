import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { env } from "@/config/env";
import { server } from "@/mocks/server";
import { useAnalysisQuota } from "./useAnalysisQuota";

function buildWrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("useAnalysisQuota", () => {
  it("분석 티켓 잔여를 조회해 반환한다", async () => {
    server.use(
      http.get(`${env.apiBaseUrl}/api/v1/me/analysis-quota`, () =>
        HttpResponse.json({
          data: {
            freeTicket: 1,
            paidTicket: 2,
            nextResetAt: "2026-07-01T00:00:00",
          },
          status: 200,
          message: "OK",
        }),
      ),
    );
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const { result } = renderHook(() => useAnalysisQuota(), {
      wrapper: buildWrapper(queryClient),
    });

    await waitFor(() =>
      expect(result.current.data).toEqual({
        freeTicket: 1,
        paidTicket: 2,
        nextResetAt: "2026-07-01T00:00:00",
      }),
    );
  });

  it("앱이 포그라운드로 돌아오면(visibilitychange) 잔여를 다시 불러온다", async () => {
    let calls = 0;
    server.use(
      http.get(`${env.apiBaseUrl}/api/v1/me/analysis-quota`, () => {
        calls += 1;
        return HttpResponse.json({
          data: {
            freeTicket: calls,
            paidTicket: 0,
            nextResetAt: "2026-07-01T00:00:00",
          },
          status: 200,
          message: "OK",
        });
      }),
    );
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const { result } = renderHook(() => useAnalysisQuota(), {
      wrapper: buildWrapper(queryClient),
    });
    await waitFor(() => expect(result.current.data?.freeTicket).toBe(1));

    // jsdom 의 visibilityState 기본값은 "visible" 이라 이벤트만 쏘면 invalidate 된다.
    document.dispatchEvent(new Event("visibilitychange"));

    await waitFor(() => expect(result.current.data?.freeTicket).toBe(2));
  });

  it("탭이 숨겨진 상태(visibilitychange·hidden)면 다시 불러오지 않는다", async () => {
    server.use(
      http.get(`${env.apiBaseUrl}/api/v1/me/analysis-quota`, () =>
        HttpResponse.json({
          data: {
            freeTicket: 1,
            paidTicket: 0,
            nextResetAt: "2026-07-01T00:00:00",
          },
          status: 200,
          message: "OK",
        }),
      ),
    );
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const { result } = renderHook(() => useAnalysisQuota(), {
      wrapper: buildWrapper(queryClient),
    });
    await waitFor(() => expect(result.current.data?.freeTicket).toBe(1));

    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });

    expect(invalidateSpy).not.toHaveBeenCalledWith({
      queryKey: ["analysisQuota"],
    });
  });
});
