import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { server } from "@/mocks/server";
import { usePollAnalysisStatus } from "./usePollAnalysisStatus";
import type { CallHistoryList } from "../types";

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

function seedCallsCache(
  queryClient: QueryClient,
  items: CallHistoryList["items"],
) {
  queryClient.setQueryData(["calls"], {
    pages: [{ items, hasNext: false }],
    pageParams: [0],
  });
}

const inProgressItem = {
  id: 42,
  partner: { id: 1042, name: "Jenson", profileImage: null },
  startedAt: "2026-05-21T19:00:00+09:00",
  durationSec: 200,
  analysisStatus: "IN_PROGRESS" as const,
};

describe("usePollAnalysisStatus", () => {
  it("enabled=false 면 폴링하지 않는다", () => {
    const queryClient = makeQueryClient();
    const { result } = renderHook(() => usePollAnalysisStatus(42, false), {
      wrapper: buildWrapper(queryClient),
    });
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("응답이 COMPLETED 면 ['calls'] 캐시의 해당 카드를 COMPLETED 로 갱신한다", async () => {
    server.use(
      http.get("http://localhost:3000/api/v1/calls/42/analysis", () =>
        HttpResponse.json({
          data: { analysisStatus: "COMPLETED", result: null },
          status: 200,
          message: "OK",
        }),
      ),
    );

    const queryClient = makeQueryClient();
    seedCallsCache(queryClient, [inProgressItem]);

    const { result } = renderHook(() => usePollAnalysisStatus(42, true), {
      wrapper: buildWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.analysisStatus).toBe("COMPLETED");

    const cache = queryClient.getQueryData<{
      pages: { items: CallHistoryList["items"] }[];
    }>(["calls"]);
    expect(cache?.pages[0]?.items[0]?.analysisStatus).toBe("COMPLETED");
  });

  it("응답이 IN_PROGRESS 면 ['calls'] 캐시는 갱신하지 않는다", async () => {
    server.use(
      http.get("http://localhost:3000/api/v1/calls/42/analysis", () =>
        HttpResponse.json({
          data: { analysisStatus: "IN_PROGRESS", result: null },
          status: 200,
          message: "OK",
        }),
      ),
    );

    const queryClient = makeQueryClient();
    seedCallsCache(queryClient, [inProgressItem]);

    const { result } = renderHook(() => usePollAnalysisStatus(42, true), {
      wrapper: buildWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const cache = queryClient.getQueryData<{
      pages: { items: CallHistoryList["items"] }[];
    }>(["calls"]);
    expect(cache?.pages[0]?.items[0]?.analysisStatus).toBe("IN_PROGRESS");
  });
});
