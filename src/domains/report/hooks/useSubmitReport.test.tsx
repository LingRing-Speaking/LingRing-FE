import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { server } from "@/mocks/server";
import { createTestQueryClient } from "../../../../test/utils/renderWithQueryClient";
import { useSubmitReport } from "./useSubmitReport";

const wrapper = ({ children }: { children: ReactNode }) => {
  const queryClient = createTestQueryClient();
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useSubmitReport", () => {
  it("성공 시 isSuccess 가 true 가 된다", async () => {
    const { result } = renderHook(() => useSubmitReport(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        reportedUserId: 7,
        reason: "BAD_MANNERS",
        description: "비매너 태도",
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("서버가 409 면 isError 가 true 다", async () => {
    server.use(
      http.post("http://localhost:3000/api/v1/reports", () =>
        HttpResponse.json(
          { data: null, status: 409, message: "ALREADY_REPORTED" },
          { status: 409 },
        ),
      ),
    );

    const { result } = renderHook(() => useSubmitReport(), { wrapper });

    await act(async () => {
      await result.current
        .mutateAsync({
          reportedUserId: 7,
          reason: "OTHER",
          description: "중복 신고",
        })
        .catch(() => undefined);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
