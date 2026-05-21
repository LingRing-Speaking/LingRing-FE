import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
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

const baseItem = {
  id: 42,
  partner: { id: 1042, name: "Jenson", profileImage: null },
  startedAt: "2026-05-21T19:00:00+09:00",
  durationSec: 200,
  analysisStatus: null,
};

describe("useRequestAnalysis", () => {
  it("mutate 호출 즉시 ['calls'] 캐시의 해당 카드만 IN_PROGRESS 로 바뀐다 (optimistic)", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    seedCallsCache(queryClient, [
      baseItem,
      { ...baseItem, id: 43, analysisStatus: "COMPLETED" },
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
      expect(items.find((i) => i.id === 42)?.analysisStatus).toBe("IN_PROGRESS");
      // 다른 카드는 영향 없음
      expect(items.find((i) => i.id === 43)?.analysisStatus).toBe("COMPLETED");
    });
  });

  it("서버가 에러를 반환하면 캐시가 이전 상태로 롤백된다", async () => {
    server.use(
      http.post("http://localhost:3000/api/v1/calls/:callId/analysis", () =>
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
    expect(cache?.pages[0]?.items[0]?.analysisStatus).toBeNull();
  });
});
