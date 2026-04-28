import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { server } from "../../../../test/msw/server";
import { createTestQueryClient } from "../../../../test/utils/renderWithQueryClient";
import { useMatchingStatus } from "./useMatchingStatus";

const wrapper = ({ children }: { children: ReactNode }) => {
  const queryClient = createTestQueryClient();
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useMatchingStatus", () => {
  it("enabled=false 면 호출하지 않는다", async () => {
    let callCount = 0;
    server.use(
      http.get("http://localhost:3000/users/1/matching", () => {
        callCount++;
        return HttpResponse.json({
          data: { status: "WAITING", partnerId: null },
          status: 200,
          message: "OK",
        });
      }),
    );

    renderHook(() => useMatchingStatus(1, false), { wrapper });

    // 짧게 대기 후 호출 0회 확인
    await new Promise((r) => setTimeout(r, 50));
    expect(callCount).toBe(0);
  });

  it("enabled=true 면 WAITING 데이터를 반환한다", async () => {
    const { result } = renderHook(() => useMatchingStatus(1, true), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({
      status: "WAITING",
      partnerId: null,
    });
  });

  it("MATCHED 응답을 받으면 폴링이 멈춘다", async () => {
    let callCount = 0;
    server.use(
      http.get("http://localhost:3000/users/1/matching", () => {
        callCount++;
        return HttpResponse.json({
          data: { status: "MATCHED", partnerId: 2 },
          status: 200,
          message: "OK",
        });
      }),
    );

    vi.useFakeTimers({ shouldAdvanceTime: true });

    const { result } = renderHook(() => useMatchingStatus(1, true), {
      wrapper,
    });

    await waitFor(() =>
      expect(result.current.data?.status).toBe("MATCHED"),
    );
    expect(callCount).toBe(1);

    // 폴링 간격(3s)의 3배 시간 진행 — 추가 호출이 없어야 함
    await vi.advanceTimersByTimeAsync(10000);
    expect(callCount).toBe(1);

    vi.useRealTimers();
  });

  it("WAITING 응답이면 3초 후 다시 폴링한다", async () => {
    let callCount = 0;
    server.use(
      http.get("http://localhost:3000/users/1/matching", () => {
        callCount++;
        return HttpResponse.json({
          data: { status: "WAITING", partnerId: null },
          status: 200,
          message: "OK",
        });
      }),
    );

    vi.useFakeTimers({ shouldAdvanceTime: true });

    const { result } = renderHook(() => useMatchingStatus(1, true), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const firstCallCount = callCount;

    await vi.advanceTimersByTimeAsync(3500);
    await waitFor(() => expect(callCount).toBeGreaterThan(firstCallCount));

    vi.useRealTimers();
  });
});
