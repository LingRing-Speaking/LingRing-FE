import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { server } from "@/mocks/server";
import { createTestQueryClient } from "../../../../test/utils/renderWithQueryClient";
import { useOutgoingInvitation } from "./useOutgoingInvitation";

const OUTGOING_URL = "http://localhost:3000/api/v1/call-invitations/outgoing";

const wrapper = ({ children }: { children: ReactNode }) => {
  const queryClient = createTestQueryClient();
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

describe("useOutgoingInvitation", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("enabled=false 면 호출하지 않는다", async () => {
    let callCount = 0;
    server.use(
      http.get(OUTGOING_URL, () => {
        callCount++;
        return HttpResponse.json({
          data: { status: "RINGING", roomId: null, callId: null },
          status: 200,
          message: "OK",
        });
      }),
    );

    renderHook(() => useOutgoingInvitation(false), { wrapper });

    await new Promise((r) => setTimeout(r, 50));
    expect(callCount).toBe(0);
  });

  it("RINGING 응답이면 1초 후 다시 폴링한다", async () => {
    let callCount = 0;
    server.use(
      http.get(OUTGOING_URL, () => {
        callCount++;
        return HttpResponse.json({
          data: { status: "RINGING", roomId: null, callId: null },
          status: 200,
          message: "OK",
        });
      }),
    );

    vi.useFakeTimers({ shouldAdvanceTime: true });

    const { result } = renderHook(() => useOutgoingInvitation(true), { wrapper });

    await waitFor(() => expect(result.current.data?.status).toBe("RINGING"));
    const firstCallCount = callCount;

    // 3초 동안 1초 폴링이라 3회 이상 추가 호출됐어야 한다
    await vi.advanceTimersByTimeAsync(3500);
    await waitFor(() => expect(callCount).toBeGreaterThanOrEqual(firstCallCount + 3));
  });

  it("ACCEPTED 응답을 받으면 폴링이 멈춘다", async () => {
    let callCount = 0;
    server.use(
      http.get(OUTGOING_URL, () => {
        callCount++;
        return HttpResponse.json({
          data: { status: "ACCEPTED", roomId: "room-1", callId: 9 },
          status: 200,
          message: "OK",
        });
      }),
    );

    vi.useFakeTimers({ shouldAdvanceTime: true });

    const { result } = renderHook(() => useOutgoingInvitation(true), { wrapper });

    await waitFor(() => expect(result.current.data?.status).toBe("ACCEPTED"));
    expect(callCount).toBe(1);

    await vi.advanceTimersByTimeAsync(5000);
    expect(callCount).toBe(1);
  });

  it("DECLINED 응답을 받으면 폴링이 멈춘다", async () => {
    let callCount = 0;
    server.use(
      http.get(OUTGOING_URL, () => {
        callCount++;
        return HttpResponse.json({
          data: { status: "DECLINED", roomId: null, callId: null },
          status: 200,
          message: "OK",
        });
      }),
    );

    vi.useFakeTimers({ shouldAdvanceTime: true });

    const { result } = renderHook(() => useOutgoingInvitation(true), { wrapper });

    await waitFor(() => expect(result.current.data?.status).toBe("DECLINED"));
    expect(callCount).toBe(1);

    await vi.advanceTimersByTimeAsync(5000);
    expect(callCount).toBe(1);
  });

  it("NONE(만료) 응답을 받으면 폴링이 멈춘다", async () => {
    let callCount = 0;
    server.use(
      http.get(OUTGOING_URL, () => {
        callCount++;
        return HttpResponse.json({
          data: { status: "NONE", roomId: null, callId: null },
          status: 200,
          message: "OK",
        });
      }),
    );

    vi.useFakeTimers({ shouldAdvanceTime: true });

    const { result } = renderHook(() => useOutgoingInvitation(true), { wrapper });

    await waitFor(() => expect(result.current.data?.status).toBe("NONE"));
    expect(callCount).toBe(1);

    await vi.advanceTimersByTimeAsync(5000);
    expect(callCount).toBe(1);
  });
});
