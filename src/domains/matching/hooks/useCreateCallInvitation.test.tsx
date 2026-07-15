import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { server } from "@/mocks/server";
import { createTestQueryClient } from "../../../../test/utils/renderWithQueryClient";
import { useCreateCallInvitation } from "./useCreateCallInvitation";

const wrapper = ({ children }: { children: ReactNode }) => {
  const queryClient = createTestQueryClient();
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

describe("useCreateCallInvitation", () => {
  it("mutate(inviteeUserId) 성공 시 isSuccess 가 true 다", async () => {
    const { result } = renderHook(() => useCreateCallInvitation(), { wrapper });

    result.current.mutate(2);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("409 응답이면 isError 가 true 이고 error 에 status 가 담긴다", async () => {
    server.use(
      http.post("http://localhost:3000/api/v1/call-invitations", () =>
        HttpResponse.json({ data: null, status: 409, message: "CONFLICT" }, { status: 409 }),
      ),
    );

    const { result } = renderHook(() => useCreateCallInvitation(), { wrapper });

    result.current.mutate(2);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ status: 409 });
  });
});
