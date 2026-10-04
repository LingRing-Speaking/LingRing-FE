import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { server } from "@/mocks/server";
import { createTestQueryClient } from "../../../../test/utils/renderWithQueryClient";
import { useRedeemReferral } from "./useRedeemReferral";

const REDEEM_URL = "http://localhost:3000/api/v1/me/referral/redeem";

function renderRedeemHook() {
  const queryClient = createTestQueryClient();
  const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useRedeemReferral(), { wrapper });
  return { result, invalidateSpy };
}

describe("useRedeemReferral", () => {
  it("입력 성공 시 황금티켓 잔여가 바뀌므로 ['analysisQuota'] 를 invalidate 한다", async () => {
    server.use(
      http.post(REDEEM_URL, () =>
        HttpResponse.json({ data: { paidTicket: 3 }, status: 200, message: "OK" }),
      ),
    );
    const { result, invalidateSpy } = renderRedeemHook();

    result.current.mutate("링링");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["analysisQuota"] });
  });

  it("입력 실패 시 ['analysisQuota'] 는 건드리지 않는다", async () => {
    server.use(
      http.post(REDEEM_URL, () =>
        HttpResponse.json(
          { data: null, status: 404, message: "없음", code: "REFERRER_NOT_FOUND" },
          { status: 404 },
        ),
      ),
    );
    const { result, invalidateSpy } = renderRedeemHook();

    result.current.mutate("없는사람");

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});
