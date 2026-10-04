import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { server } from "@/mocks/server";
import { createTestQueryClient } from "../../../../test/utils/renderWithQueryClient";
import { REFERRAL_STATUS_QUERY_KEY, useReferralStatus } from "./useReferralStatus";

describe("useReferralStatus", () => {
  it("['referral'] 키로 입력 가능 여부를 조회한다", async () => {
    server.use(
      http.get("http://localhost:3000/api/v1/me/referral", () =>
        HttpResponse.json({
          data: { redeemable: false, redeemableUntil: "2026-10-10T12:00:00" },
          status: 200,
          message: "OK",
        }),
      ),
    );
    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useReferralStatus(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({
      redeemable: false,
      redeemableUntil: "2026-10-10T12:00:00",
    });
    expect(REFERRAL_STATUS_QUERY_KEY).toEqual(["referral"]);
  });
});
