import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { server } from "@/mocks/server";
import { createTestQueryClient } from "../../../../test/utils/renderWithQueryClient";
import { useReceivedCount } from "./useReceivedCount";

const wrapper = ({ children }: { children: ReactNode }) => {
  const queryClient = createTestQueryClient();
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

describe("useReceivedCount", () => {
  it("받은 요청 개수를 반환한다 (시드 2건)", async () => {
    const { result } = renderHook(() => useReceivedCount(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.count).toBe(2);
  });

  it("서버가 0 을 주면 count 0 이다", async () => {
    server.use(
      http.get("http://localhost:3000/api/v1/friends/received-count", () =>
        HttpResponse.json({ data: { count: 0 }, status: 200, message: "OK" }),
      ),
    );

    const { result } = renderHook(() => useReceivedCount(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.count).toBe(0);
  });
});
