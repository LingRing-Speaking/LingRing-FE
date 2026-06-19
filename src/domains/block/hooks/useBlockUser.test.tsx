import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { server } from "@/mocks/server";
import { createTestQueryClient } from "../../../../test/utils/renderWithQueryClient";
import { useBlockUser } from "./useBlockUser";

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

describe("useBlockUser", () => {
  it("성공 시 isSuccess 가 true 가 된다", async () => {
    const { wrapper } = setupHarness();
    const { result } = renderHook(() => useBlockUser(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ blockedUserId: 42 });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("성공 시 ['blocks'] 쿼리를 invalidate 한다", async () => {
    const { queryClient, wrapper } = setupHarness();
    queryClient.setQueryData(["blocks"], { pages: [], pageParams: [] });
    const before = queryClient.getQueryState(["blocks"]);

    const { result } = renderHook(() => useBlockUser(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ blockedUserId: 42 });
    });

    await waitFor(() => {
      const after = queryClient.getQueryState(["blocks"]);
      expect(after?.isInvalidated).toBe(true);
    });
    expect(before?.isInvalidated).toBe(false);
  });

  it("400 응답이면 isError 가 true 다", async () => {
    server.use(
      http.post("http://localhost:3000/api/v1/blocks", () =>
        HttpResponse.json(
          { data: null, status: 400, message: "SELF_BLOCK_NOT_ALLOWED" },
          { status: 400 },
        ),
      ),
    );

    const { wrapper } = setupHarness();
    const { result } = renderHook(() => useBlockUser(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ blockedUserId: 1 }).catch(() => undefined);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
