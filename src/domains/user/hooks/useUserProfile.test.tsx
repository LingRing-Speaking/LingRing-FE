import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { server } from "@/mocks/server";
import { createTestQueryClient } from "../../../../test/utils/renderWithQueryClient";
import { useUserProfile } from "./useUserProfile";

const wrapper = ({ children }: { children: ReactNode }) => {
  const queryClient = createTestQueryClient();
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useUserProfile", () => {
  it("성공 시 UserProfile 을 data 로 반환한다", async () => {
    server.use(
      http.get("http://localhost:3000/api/v1/users/7", () =>
        HttpResponse.json({
          status: 200,
          message: "OK",
          data: {
            id: 7,
            nickname: "Sophie",
            level: "ADVANCED",
            mannerTemperature: 38.5,
          },
        }),
      ),
    );

    const { result } = renderHook(() => useUserProfile(7), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({
      id: 7,
      nickname: "Sophie",
      level: "ADVANCED",
      mannerTemperature: 38.5,
    });
  });

  it("userId 가 null 이면 호출하지 않는다", () => {
    let called = 0;
    server.use(
      http.get("http://localhost:3000/api/v1/users/:id", () => {
        called += 1;
        return HttpResponse.json({ data: null }, { status: 200 });
      }),
    );

    const { result } = renderHook(() => useUserProfile(null), { wrapper });

    expect(result.current.isPending).toBe(true);
    expect(result.current.fetchStatus).toBe("idle");
    expect(called).toBe(0);
  });

  it("404 응답이면 isError 가 true 다", async () => {
    server.use(
      http.get("http://localhost:3000/api/v1/users/999", () =>
        HttpResponse.json(
          { data: null, status: 404, message: "USER_NOT_FOUND" },
          { status: 404 },
        ),
      ),
    );

    const { result } = renderHook(() => useUserProfile(999), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
