import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { env } from "@/config/env";
import { ApiError } from "@/lib/http";
import { server } from "@/mocks/server";
import { useCallTranscript } from "./useCallTranscript";

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

describe("useCallTranscript", () => {
  it("enabled 가 true 면 transcript 를 조회해 segments 를 반환한다", async () => {
    server.use(
      http.get(`${env.apiBaseUrl}/api/v1/calls/50/transcript`, () =>
        HttpResponse.json({
          data: {
            callId: 50,
            segments: [
              { userId: 1, startSec: 0, endSec: 2, text: "Hello." },
              { userId: 2, startSec: 2.5, endSec: 4, text: "Hi there." },
            ],
          },
          status: 200,
          message: "OK",
        }),
      ),
    );

    const { result } = renderHook(() => useCallTranscript(50, true), {
      wrapper: buildWrapper(makeQueryClient()),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.callId).toBe(50);
    expect(result.current.data?.segments).toHaveLength(2);
  });

  it("enabled 가 false 면 요청을 보내지 않는다 (lazy)", async () => {
    let called = false;
    server.use(
      http.get(`${env.apiBaseUrl}/api/v1/calls/51/transcript`, () => {
        called = true;
        return HttpResponse.json({
          data: { callId: 51, segments: [] },
          status: 200,
          message: "OK",
        });
      }),
    );

    const { result } = renderHook(() => useCallTranscript(51, false), {
      wrapper: buildWrapper(makeQueryClient()),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(called).toBe(false);
  });

  it("409 면 isError 로 떨어지고 error.status 가 409 다", async () => {
    server.use(
      http.get(`${env.apiBaseUrl}/api/v1/calls/52/transcript`, () =>
        HttpResponse.json(
          {
            data: null,
            status: 409,
            message: "통화 transcript가 아직 준비되지 않았습니다.",
          },
          { status: 409 },
        ),
      ),
    );

    const { result } = renderHook(() => useCallTranscript(52, true), {
      wrapper: buildWrapper(makeQueryClient()),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(ApiError);
    expect((result.current.error as ApiError).status).toBe(409);
  });
});
