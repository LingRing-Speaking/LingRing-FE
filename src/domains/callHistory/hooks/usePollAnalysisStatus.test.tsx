import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "@/config/env";
import { server } from "@/mocks/server";
import { usePollAnalysisStatus } from "./usePollAnalysisStatus";

function buildWrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

describe("usePollAnalysisStatus", () => {
  it("응답이 PROCESSING 이면 success 로 떨어지고 status 가 PROCESSING 으로 들어온다", async () => {
    server.use(
      http.get(`${env.apiBaseUrl}/api/v1/analyses/777/status`, () =>
        HttpResponse.json({
          data: { status: "PROCESSING" },
          status: 200,
          message: "OK",
        }),
      ),
    );

    const queryClient = makeQueryClient();
    const { result } = renderHook(() => usePollAnalysisStatus(777), {
      wrapper: buildWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.status).toBe("PROCESSING");
  });

  it("응답이 COMPLETED 면 status 가 COMPLETED 로 들어온다", async () => {
    server.use(
      http.get(`${env.apiBaseUrl}/api/v1/analyses/778/status`, () =>
        HttpResponse.json({
          data: { status: "COMPLETED" },
          status: 200,
          message: "OK",
        }),
      ),
    );

    const queryClient = makeQueryClient();
    const { result } = renderHook(() => usePollAnalysisStatus(778), {
      wrapper: buildWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.status).toBe("COMPLETED");
  });

  it("응답이 FAILED 여도 success 로 떨어진다 (에러가 아니라 정상 응답)", async () => {
    server.use(
      http.get(`${env.apiBaseUrl}/api/v1/analyses/779/status`, () =>
        HttpResponse.json({
          data: { status: "FAILED" },
          status: 200,
          message: "OK",
        }),
      ),
    );

    const queryClient = makeQueryClient();
    const { result } = renderHook(() => usePollAnalysisStatus(779), {
      wrapper: buildWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.status).toBe("FAILED");
  });

  describe("폴링 정지 검증", () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("COMPLETED 이면 추가 폴링 요청을 보내지 않는다", async () => {
      let callCount = 0;
      server.use(
        http.get(`${env.apiBaseUrl}/api/v1/analyses/780/status`, () => {
          callCount++;
          return HttpResponse.json({
            data: { status: "COMPLETED" },
            status: 200,
            message: "OK",
          });
        }),
      );

      const queryClient = makeQueryClient();
      renderHook(() => usePollAnalysisStatus(780), {
        wrapper: buildWrapper(queryClient),
      });

      // 첫 요청 완료 대기
      await waitFor(() => expect(callCount).toBeGreaterThanOrEqual(1));
      const countAfterFirst = callCount;

      // 폴링 간격(3초) 이상 대기해도 추가 요청 없음
      await vi.advanceTimersByTimeAsync(5000);
      expect(callCount).toBe(countAfterFirst);
    });

    it("FAILED 이면 추가 폴링 요청을 보내지 않는다", async () => {
      let callCount = 0;
      server.use(
        http.get(`${env.apiBaseUrl}/api/v1/analyses/781/status`, () => {
          callCount++;
          return HttpResponse.json({
            data: { status: "FAILED" },
            status: 200,
            message: "OK",
          });
        }),
      );

      const queryClient = makeQueryClient();
      renderHook(() => usePollAnalysisStatus(781), {
        wrapper: buildWrapper(queryClient),
      });

      await waitFor(() => expect(callCount).toBeGreaterThanOrEqual(1));
      const countAfterFirst = callCount;

      await vi.advanceTimersByTimeAsync(5000);
      expect(callCount).toBe(countAfterFirst);
    });

    it("enabled 가 false 이면 쿼리를 실행하지 않는다", async () => {
      let callCount = 0;
      server.use(
        http.get(`${env.apiBaseUrl}/api/v1/analyses/782/status`, () => {
          callCount++;
          return HttpResponse.json({
            data: { status: "PROCESSING" },
            status: 200,
            message: "OK",
          });
        }),
      );

      const queryClient = makeQueryClient();
      const { result } = renderHook(
        () => usePollAnalysisStatus(782, { enabled: false }),
        { wrapper: buildWrapper(queryClient) },
      );

      // 충분한 시간 대기 후에도 요청 없음
      await vi.advanceTimersByTimeAsync(5000);
      expect(callCount).toBe(0);
      expect(result.current.fetchStatus).toBe("idle");
    });
  });
});
