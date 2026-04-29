import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { server } from "../../../../test/msw/server";
import { createTestQueryClient } from "../../../../test/utils/renderWithQueryClient";
import { useEnterMatchingQueue } from "./useEnterMatchingQueue";

const wrapper = ({ children }: { children: ReactNode }) => {
  const queryClient = createTestQueryClient();
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useEnterMatchingQueue", () => {
  it("mutate 호출 후 성공하면 isSuccess 가 true 다", async () => {
    const { result } = renderHook(() => useEnterMatchingQueue(), { wrapper });

    result.current.mutate(1);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("500 응답이면 isError 가 true 다", async () => {
    server.use(
      http.post("http://localhost:3000/users/1/matching", () =>
        HttpResponse.json(
          { data: null, status: 500, message: "fail" },
          { status: 500 },
        ),
      ),
    );

    const { result } = renderHook(() => useEnterMatchingQueue(), { wrapper });

    result.current.mutate(1);

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
