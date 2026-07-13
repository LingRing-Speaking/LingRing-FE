import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { createTestQueryClient } from "../../../../test/utils/renderWithQueryClient";
import { usePendingRequests } from "./usePendingRequests";

const wrapper = ({ children }: { children: ReactNode }) => {
  const queryClient = createTestQueryClient();
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

describe("usePendingRequests", () => {
  it("RECEIVED 는 받은 요청만 반환한다", async () => {
    const { result } = renderHook(() => usePendingRequests("RECEIVED"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const items = result.current.data?.pages[0]?.items ?? [];
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((item) => item.direction === "RECEIVED")).toBe(true);
  });

  it("SENT 는 보낸 요청만 반환한다", async () => {
    const { result } = renderHook(() => usePendingRequests("SENT"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const items = result.current.data?.pages[0]?.items ?? [];
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((item) => item.direction === "SENT")).toBe(true);
  });
});
