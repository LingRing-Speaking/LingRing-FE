import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/mocks/server";
import { renderWithQueryClient } from "../../../../test/utils/renderWithQueryClient";
import { ReferralSetting } from "./ReferralSetting";

const STATUS_URL = "http://localhost:3000/api/v1/me/referral";

function mockStatus(redeemable: boolean) {
  server.use(
    http.get(STATUS_URL, () =>
      HttpResponse.json({
        data: { redeemable, redeemableUntil: "2026-10-10T12:00:00" },
        status: 200,
        message: "OK",
      }),
    ),
  );
}

describe("ReferralSetting", () => {
  it("입력 가능하면 추천인 입력 행을 보여준다", async () => {
    mockStatus(true);
    renderWithQueryClient(<ReferralSetting />);

    expect(await screen.findByRole("button", { name: "추천인 입력" })).toBeInTheDocument();
  });

  it("입력 불가면 아무것도 보여주지 않는다", async () => {
    let requested = false;
    server.use(
      http.get(STATUS_URL, () => {
        requested = true;
        return HttpResponse.json({
          data: { redeemable: false, redeemableUntil: "2026-10-10T12:00:00" },
          status: 200,
          message: "OK",
        });
      }),
    );
    renderWithQueryClient(<ReferralSetting />);

    await waitFor(() => expect(requested).toBe(true));
    expect(screen.queryByRole("button", { name: "추천인 입력" })).not.toBeInTheDocument();
  });

  it("행을 누르면 입력 모달이 열리고, 닫기를 누르면 닫힌다", async () => {
    const user = userEvent.setup();
    mockStatus(true);
    renderWithQueryClient(<ReferralSetting />);

    await user.click(await screen.findByRole("button", { name: "추천인 입력" }));
    expect(screen.getByRole("dialog", { name: "추천인이 있나요?" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "닫기" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("입력 성공 후 모달을 닫으면 상태를 다시 조회해 행이 사라진다", async () => {
    const user = userEvent.setup();
    let redeemed = false;
    server.use(
      http.get(STATUS_URL, () =>
        HttpResponse.json({
          data: { redeemable: !redeemed, redeemableUntil: "2026-10-10T12:00:00" },
          status: 200,
          message: "OK",
        }),
      ),
      http.post(`${STATUS_URL}/redeem`, () => {
        redeemed = true;
        return HttpResponse.json({ data: { paidTicket: 3 }, status: 200, message: "OK" });
      }),
    );
    renderWithQueryClient(<ReferralSetting />);

    await user.click(await screen.findByRole("button", { name: "추천인 입력" }));
    await user.type(screen.getByLabelText("추천인 닉네임"), "링링");
    await user.click(screen.getByRole("button", { name: "입력하기" }));

    // 안내를 보는 동안에는 모달이 유지된다.
    await user.click(await screen.findByRole("button", { name: "확인" }));

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "추천인 입력" })).not.toBeInTheDocument(),
    );
  });
});
