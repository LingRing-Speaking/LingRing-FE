import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { server } from "@/mocks/server";
import { createTestQueryClient } from "../../../../test/utils/renderWithQueryClient";
import { useUnblockUser } from "./useUnblockUser";

type Harness = {
  queryClient: QueryClient;
  wrapper: ({ children }: { children: ReactNode }) => JSX.Element;
};

const setupHarness = (): Harness => {
  const queryClient = createTestQueryClient();
  return {
    queryClient,
    wrapper: ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  };
};

describe("useUnblockUser", () => {
  it("성공 시 isSuccess 가 true 가 된다", async () => {
    const { wrapper } = setupHarness();
    const { result } = renderHook(() => useUnblockUser(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(42);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("성공 시 ['blocks'] 쿼리를 invalidate 한다", async () => {
    const { queryClient, wrapper } = setupHarness();
    queryClient.setQueryData(["blocks"], { pages: [], pageParams: [] });

    const { result } = renderHook(() => useUnblockUser(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(42);
    });

    await waitFor(() => {
      const after = queryClient.getQueryState(["blocks"]);
      expect(after?.isInvalidated).toBe(true);
    });
  });

  it("500 응답이면 isError 가 true 다", async () => {
    server.use(
      http.delete("http://localhost:3000/api/v1/blocks/:blockedUserId", () =>
        HttpResponse.json({ data: null, status: 500, message: "INTERNAL" }, { status: 500 }),
      ),
    );

    const { wrapper } = setupHarness();
    const { result } = renderHook(() => useUnblockUser(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(42).catch(() => undefined);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
