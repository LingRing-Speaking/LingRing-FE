import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { createTestQueryClient } from "../../../../test/utils/renderWithQueryClient";
import { server } from "@/mocks/server";
import { useUserMy } from "./useUserMy";

const wrapper = ({ children }: { children: ReactNode }) => {
  const queryClient = createTestQueryClient();
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useUserMy", () => {
  it("성공 시 UserMy 를 data 로 반환한다", async () => {
    const { result } = renderHook(() => useUserMy(1), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ id: 1, name: "Lee" });
  });

  it("404 응답 시 isError 가 true 이고 error 가 ApiError 다", async () => {
    server.use(
      http.get("http://localhost:3000/users/999/my", () =>
        HttpResponse.json(
          { data: null, status: 404, message: "사용자를 찾을 수 없습니다." },
          { status: 404 },
        ),
      ),
    );

    const { result } = renderHook(() => useUserMy(999), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("사용자를 찾을 수 없습니다.");
  });
});
