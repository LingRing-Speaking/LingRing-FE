import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { CallHistoryItem } from "@/domains/callHistory/types";
import { CallHistoryList } from "./CallHistoryList";

const NOW = new Date(2026, 3, 29, 14, 0, 0);

function makeCall(
  id: number,
  startedAt: Date,
  overrides: Partial<CallHistoryItem> = {},
): CallHistoryItem {
  return {
    id,
    partner: { id: 1000 + id, name: `P${id}`, profileImage: null },
    startedAt: startedAt.toISOString(),
    durationSec: 60 + id,
    analysisStatus: "NONE",
    ...overrides,
  };
}

function renderWithRouter(ui: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/history"]}>
        <Routes>
          <Route path="/history" element={ui} />
          <Route path="/calls/:callId/analysis" element={<div>analysis</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("CallHistoryList", () => {
  it("그룹 헤더와 카드를 순서대로 렌더한다", () => {
    const items = [
      makeCall(1, new Date(2026, 3, 29, 19, 0)), // today
      makeCall(2, new Date(2026, 3, 28, 12, 0)), // thisWeek
      makeCall(3, new Date(2026, 3, 12, 12, 0)), // byMonth(4월) — thisMonth는 이번 주 이전 같은 달
    ];
    renderWithRouter(
      <CallHistoryList
        items={items}
        now={NOW}
        hasNextPage={false}
        isFetchingNextPage={false}
        onLoadMore={() => {}}
        onPartnerClick={() => {}}
      />,
    );

    const headings = screen.getAllByRole("heading", { level: 2 });
    expect(headings.map((h) => h.textContent)).toEqual([
      "오늘",
      "이번 주",
      "이번 달",
    ]);
    expect(screen.getByText("P1")).toBeInTheDocument();
    expect(screen.getByText("P2")).toBeInTheDocument();
    expect(screen.getByText("P3")).toBeInTheDocument();
  });

  it("sentinel 이 뷰포트에 들어오면 onLoadMore 를 호출한다 (hasNextPage=true)", () => {
    const onLoadMore = vi.fn();
    let observerCb: IntersectionObserverCallback | undefined;
    class CapturingObserver {
      constructor(cb: IntersectionObserverCallback) {
        observerCb = cb;
      }
      observe() {}
      disconnect() {}
      unobserve() {}
      takeRecords() {
        return [];
      }
      root = null;
      rootMargin = "";
      thresholds = [];
    }
    vi.stubGlobal("IntersectionObserver", CapturingObserver);

    const items = [makeCall(1, new Date(2026, 3, 29, 12, 0))];
    renderWithRouter(
      <CallHistoryList
        items={items}
        now={NOW}
        hasNextPage={true}
        isFetchingNextPage={false}
        onLoadMore={onLoadMore} onPartnerClick={() => {}}
      />,
    );

    // sentinel 이 보이는 척 콜백을 직접 호출
    observerCb?.(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );

    expect(onLoadMore).toHaveBeenCalledTimes(1);

    vi.unstubAllGlobals();
  });

  it("hasNextPage=false 면 sentinel observer 를 만들지 않거나 호출해도 onLoadMore 는 안 불린다", () => {
    const onLoadMore = vi.fn();
    let observerCb: IntersectionObserverCallback | undefined;
    class CapturingObserver {
      constructor(cb: IntersectionObserverCallback) {
        observerCb = cb;
      }
      observe() {}
      disconnect() {}
      unobserve() {}
      takeRecords() {
        return [];
      }
      root = null;
      rootMargin = "";
      thresholds = [];
    }
    vi.stubGlobal("IntersectionObserver", CapturingObserver);

    const items = [makeCall(1, new Date(2026, 3, 29, 12, 0))];
    renderWithRouter(
      <CallHistoryList
        items={items}
        now={NOW}
        hasNextPage={false}
        isFetchingNextPage={false}
        onLoadMore={onLoadMore} onPartnerClick={() => {}}
      />,
    );

    observerCb?.(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );

    expect(onLoadMore).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
