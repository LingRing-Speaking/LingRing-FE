import { renderHook, waitFor } from "@testing-library/react";
import { useQuery } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/mocks/server";
import { QueryProvider } from "./QueryProvider";

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
