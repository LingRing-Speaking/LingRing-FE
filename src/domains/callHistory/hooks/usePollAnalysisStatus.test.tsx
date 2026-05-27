import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
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
});
