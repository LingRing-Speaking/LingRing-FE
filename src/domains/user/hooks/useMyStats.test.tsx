import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { createTestQueryClient } from "../../../../test/utils/renderWithQueryClient";
import { useMyStats } from "./useMyStats";

const wrapper = ({ children }: { children: ReactNode }) => {
  const queryClient = createTestQueryClient();
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useMyStats", () => {
  it("성공 시 UserStats 를 data 로 반환한다", async () => {
    const { result } = renderHook(() => useMyStats(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toMatchObject({
      userId: 1,
      level: "INTERMEDIATE",
      mannerTemperature: 36.5,
    });
  });
});
