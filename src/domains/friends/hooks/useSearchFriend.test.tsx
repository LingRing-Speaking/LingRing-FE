import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { createTestQueryClient } from "../../../../test/utils/renderWithQueryClient";
import { useSearchFriend } from "./useSearchFriend";

const wrapper = ({ children }: { children: ReactNode }) => {
  const queryClient = createTestQueryClient();
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

describe("useSearchFriend", () => {
  it("정확 일치 유저를 relation 과 함께 반환한다", async () => {
    const { result } = renderHook(() => useSearchFriend("지훈"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toMatchObject({ nickname: "지훈", relation: "NONE" });
  });

  it("일치가 없으면 null 을 반환한다", async () => {
    const { result } = renderHook(() => useSearchFriend("없는닉네임"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it("닉네임이 비어 있으면 비활성(요청하지 않음)이다", () => {
    const { result } = renderHook(() => useSearchFriend(""), { wrapper });

    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.data).toBeUndefined();
  });
});
