import { renderHook, waitFor } from "@testing-library/react";
import { CancelledError, MutationObserver, useQuery } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/http";
import { captureException } from "@/lib/sentry";
import { server } from "@/mocks/server";
import { QueryProvider } from "./QueryProvider";
import { createQueryClient } from "./queryClient";

vi.mock("@/lib/sentry", () => ({
  captureException: vi.fn(),
}));

const mockCapture = vi.mocked(captureException);

function useTestQuery(path: string) {
  return useQuery({
    queryKey: ["retry-test", path],
    queryFn: async () => {
      const res = await fetch(`http://localhost:3000/api/v1${path}`);
      if (!res.ok) {
        const { ApiError } = await import("@/lib/http");
        throw new ApiError(res.status, "error");
      }
      return res.json();
    },
  });
}

describe("QueryProvider retry", () => {
  it("401 응답 시 재시도하지 않는다", async () => {
    let callCount = 0;
    server.use(
      http.get("http://localhost:3000/api/v1/no-retry", () => {
        callCount += 1;
        return HttpResponse.json({}, { status: 401 });
      }),
    );

    const { result } = renderHook(() => useTestQuery("/no-retry"), {
      wrapper: ({ children }) => <QueryProvider>{children}</QueryProvider>,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(callCount).toBe(1);
  });

  it("403 응답 시 재시도하지 않는다", async () => {
    let callCount = 0;
    server.use(
      http.get("http://localhost:3000/api/v1/forbidden", () => {
        callCount += 1;
        return HttpResponse.json({}, { status: 403 });
      }),
    );

    const { result } = renderHook(() => useTestQuery("/forbidden"), {
      wrapper: ({ children }) => <QueryProvider>{children}</QueryProvider>,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(callCount).toBe(1);
  });

  it("500 응답 시 최대 3회 재시도한다", { timeout: 15_000 }, async () => {
    let callCount = 0;
    server.use(
      http.get("http://localhost:3000/api/v1/server-err", () => {
        callCount += 1;
        return HttpResponse.json({}, { status: 500 });
      }),
    );

    const { result } = renderHook(() => useTestQuery("/server-err"), {
      wrapper: ({ children }) => <QueryProvider>{children}</QueryProvider>,
    });

    await waitFor(() => expect(result.current.isError).toBe(true), {
      timeout: 10_000,
    });
    expect(callCount).toBe(4);
  });
});

async function runFailingQuery(error: Error): Promise<void> {
  const client = createQueryClient();
  await client
    .fetchQuery({
      queryKey: ["boom"],
      queryFn: () => Promise.reject(error),
      retry: false,
    })
    .catch(() => {});
}

async function runFailingMutation(error: Error): Promise<void> {
  const client = createQueryClient();
  const observer = new MutationObserver(client, {
    mutationKey: ["boomMutation"],
    mutationFn: () => Promise.reject(error),
    retry: false,
  });
  await observer.mutate(undefined).catch(() => {});
}

describe("createQueryClient — 전역 onError Sentry 안전망", () => {
  beforeEach(() => {
    mockCapture.mockClear();
  });

  it("쿼리 실패를 queryKey와 함께 Sentry로 보고한다", async () => {
    const error = new ApiError(500, "서버 오류");

    await runFailingQuery(error);

    expect(mockCapture).toHaveBeenCalledTimes(1);
    expect(mockCapture).toHaveBeenCalledWith(error, {
      tags: { source: "query" },
      extra: { queryKey: ["boom"] },
    });
  });

  it("뮤테이션 실패를 mutationKey와 함께 Sentry로 보고한다", async () => {
    const error = new TypeError("undefined is not a function");

    await runFailingMutation(error);

    expect(mockCapture).toHaveBeenCalledTimes(1);
    expect(mockCapture).toHaveBeenCalledWith(error, {
      tags: { source: "mutation" },
      extra: { mutationKey: ["boomMutation"] },
    });
  });

  it("네트워크 단절(status 0)은 보고하지 않는다", async () => {
    await runFailingQuery(new ApiError(0, "네트워크 오류"));

    expect(mockCapture).not.toHaveBeenCalled();
  });

  it("세션 만료(401)는 보고하지 않는다", async () => {
    await runFailingQuery(new ApiError(401, "인증 만료"));

    expect(mockCapture).not.toHaveBeenCalled();
  });

  it("요청 취소(CancelledError)는 보고하지 않는다", async () => {
    await runFailingQuery(new CancelledError() as unknown as Error);

    expect(mockCapture).not.toHaveBeenCalled();
  });
});
