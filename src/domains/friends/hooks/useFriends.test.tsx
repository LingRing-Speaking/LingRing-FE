import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { createTestQueryClient } from "../../../../test/utils/renderWithQueryClient";
import { useFriends } from "./useFriends";

const wrapper = ({ children }: { children: ReactNode }) => {
  const queryClient = createTestQueryClient();
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

describe("useFriends", () => {
  it("친구 목록(ACCEPTED) 첫 페이지를 반환한다", async () => {
    const { result } = renderHook(() => useFriends(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const items = result.current.data?.pages[0]?.items ?? [];
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((item) => item.status === "ACCEPTED")).toBe(true);
  });
});
