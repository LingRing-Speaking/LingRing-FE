import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { server } from "@/mocks/server";
import { createTestQueryClient } from "../../../../test/utils/renderWithQueryClient";
import { useRandomIcebreakers } from "./useRandomIcebreakers";

const wrapper = ({ children }: { children: ReactNode }) => {
  const queryClient = createTestQueryClient();
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useRandomIcebreakers", () => {
  it("성공 시 5개 아이스브레이커 배열을 data 로 반환한다", async () => {
    const { result } = renderHook(() => useRandomIcebreakers(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(5);
  });

  it("500 응답이면 isError 가 true 다", async () => {
    server.use(
      http.get("http://localhost:3000/icebreakers", () =>
        HttpResponse.json(
          { data: null, status: 500, message: "fail" },
          { status: 500 },
        ),
      ),
    );

    const { result } = renderHook(() => useRandomIcebreakers(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
