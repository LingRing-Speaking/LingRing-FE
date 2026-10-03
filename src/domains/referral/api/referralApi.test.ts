import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/mocks/server";
import { fetchReferralStatus, redeemReferral } from "./referralApi";

const STATUS_URL = "http://localhost:3000/api/v1/me/referral";
const REDEEM_URL = "http://localhost:3000/api/v1/me/referral/redeem";

describe("fetchReferralStatus", () => {
  it("GET /me/referral 의 입력 가능 여부를 돌려준다", async () => {
    server.use(
      http.get(STATUS_URL, () =>
        HttpResponse.json({
          data: { redeemable: true, redeemableUntil: "2026-10-10T12:00:00" },
          status: 200,
          message: "OK",
        }),
      ),
    );

    await expect(fetchReferralStatus()).resolves.toEqual({
      redeemable: true,
      redeemableUntil: "2026-10-10T12:00:00",
    });
  });
});

describe("redeemReferral", () => {
  it("추천인 닉네임을 POST 로 보내고 지급 후 황금티켓 수를 돌려준다", async () => {
    let receivedBody: unknown = null;
    server.use(
      http.post(REDEEM_URL, async ({ request }) => {
        receivedBody = await request.json();
        return HttpResponse.json({ data: { paidTicket: 3 }, status: 200, message: "OK" });
      }),
    );

    const result = await redeemReferral("링링");

    expect(receivedBody).toEqual({ nickname: "링링" });
    expect(result).toEqual({ paidTicket: 3 });
  });

  it("실패 응답의 code 를 담은 ApiError 로 throw 된다", async () => {
    server.use(
      http.post(REDEEM_URL, () =>
        HttpResponse.json(
          { data: null, status: 404, message: "없음", code: "REFERRER_NOT_FOUND" },
          { status: 404 },
        ),
      ),
    );

    await expect(redeemReferral("없는사람")).rejects.toMatchObject({
      status: 404,
      code: "REFERRER_NOT_FOUND",
    });
  });
});
