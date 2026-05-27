import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { env } from "@/config/env";
import { server } from "@/mocks/server";
import { useRequestAnalysis } from "./useRequestAnalysis";
import type { CallHistoryList } from "../types";

function buildWrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

function seedCallsCache(queryClient: QueryClient, items: CallHistoryList["items"]) {
  queryClient.setQueryData(["calls"], {
    pages: [{ items, hasNext: false }],
    pageParams: [0],
  });
}

const baseItem: CallHistoryList["items"][number] = {
  id: 42,
  partner: { id: 1042, name: "Jenson", profileImage: null },
  startedAt: "2026-05-21T19:00:00+09:00",
  durationSec: 200,
  analysisId: null,
  analysisStatus: "READY",
};

describe("useRequestAnalysis", () => {
  it("응답 성공 시 ['calls'] 캐시의 해당 카드만 analysisId + PROCESSING 으로 갱신된다", async () => {
    server.use(
      http.post(`${env.apiBaseUrl}/api/v1/calls/:callId/analysis`, () =>
        HttpResponse.json(
          { data: { analysisId: 777 }, status: 202, message: "ACCEPTED" },
          { status: 202 },
        ),
      ),
    );

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    seedCallsCache(queryClient, [
      baseItem,
      { ...baseItem, id: 43, analysisId: 500, analysisStatus: "COMPLETED" },
    ]);

    const { result } = renderHook(() => useRequestAnalysis(), {
      wrapper: buildWrapper(queryClient),
    });

    result.current.mutate(42);

    await waitFor(() => {
      const cache = queryClient.getQueryData<{
        pages: { items: CallHistoryList["items"] }[];
      }>(["calls"]);
      const items = cache?.pages[0]?.items ?? [];
      const target = items.find((i) => i.id === 42);
      const other = items.find((i) => i.id === 43);
      expect(target?.analysisId).toBe(777);
      expect(target?.analysisStatus).toBe("PROCESSING");
      // 다른 카드는 손대지 않음.
      expect(other?.analysisId).toBe(500);
      expect(other?.analysisStatus).toBe("COMPLETED");
    });
  });

  it("서버 에러 시 캐시는 그대로 유지된다 (현재 onError 동작은 no-op)", async () => {
    server.use(
      http.post(`${env.apiBaseUrl}/api/v1/calls/:callId/analysis`, () =>
        HttpResponse.json(
          { data: null, status: 500, message: "INTERNAL" },
          { status: 500 },
        ),
      ),
    );

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    seedCallsCache(queryClient, [baseItem]);

    const { result } = renderHook(() => useRequestAnalysis(), {
      wrapper: buildWrapper(queryClient),
    });

    result.current.mutate(42);

    await waitFor(() => expect(result.current.isError).toBe(true));
    const cache = queryClient.getQueryData<{
      pages: { items: CallHistoryList["items"] }[];
    }>(["calls"]);
    expect(cache?.pages[0]?.items[0]?.analysisId).toBeNull();
    expect(cache?.pages[0]?.items[0]?.analysisStatus).toBe("READY");
  });
});
