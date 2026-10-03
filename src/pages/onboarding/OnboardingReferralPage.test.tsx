import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { Route, Routes } from "react-router-dom";
import { server } from "@/mocks/server";
import { renderWithQueryClient } from "../../../test/utils/renderWithQueryClient";
import { OnboardingReferralPage } from "./OnboardingReferralPage";

const STATUS_URL = "http://localhost:3000/api/v1/me/referral";
const REDEEM_URL = "http://localhost:3000/api/v1/me/referral/redeem";

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

function renderPage() {
  return renderWithQueryClient(
    <Routes>
      <Route path="/onboarding/referral" element={<OnboardingReferralPage />} />
      <Route path="/home" element={<div>홈 화면</div>} />
    </Routes>,
    { initialEntries: ["/onboarding/referral"] },
  );
}

describe("OnboardingReferralPage", () => {
  it("입력 가능하면 추천인 입력 카드를 보여준다", async () => {
    mockStatus(true);
    renderPage();

    expect(await screen.findByRole("dialog", { name: "추천인이 있나요?" })).toBeInTheDocument();
  });

  it("건너뛰기를 누르면 마감일까지 설정에서 입력할 수 있다고 안내하고, 확인을 누르면 /home 으로 간다", async () => {
    const user = userEvent.setup();
    mockStatus(true);
    renderPage();

    await user.click(await screen.findByRole("button", { name: "건너뛰기" }));

    expect(screen.getByRole("dialog", { name: "나중에 입력해도 괜찮아요" })).toBeInTheDocument();
    expect(screen.getByText(/10월 10일까지/)).toBeInTheDocument();
    expect(screen.getByText(/설정 > 추천인 입력/)).toBeInTheDocument();
    expect(screen.queryByText("홈 화면")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "확인" }));
    expect(screen.getByText("홈 화면")).toBeInTheDocument();
  });

  // 재가입자 등은 가입 직후부터 redeemable=false — 입력해도 403 이므로 단계 자체를 건너뛴다.
  it("입력 불가면 카드 없이 /home 으로 보낸다", async () => {
    mockStatus(false);
    renderPage();

    expect(await screen.findByText("홈 화면")).toBeInTheDocument();
  });

  // 조회 실패로 온보딩이 막히면 안 된다. 놓친 입력은 설정 진입점에서 할 수 있다.
  it("상태 조회에 실패하면 /home 으로 보낸다", async () => {
    server.use(
      http.get(STATUS_URL, () =>
        HttpResponse.json({ data: null, status: 500, message: "boom" }, { status: 500 }),
      ),
    );
    renderPage();

    expect(await screen.findByText("홈 화면")).toBeInTheDocument();
  });

  it("입력 성공 후 지급 안내의 확인을 누르면 /home 으로 간다", async () => {
    const user = userEvent.setup();
    mockStatus(true);
    server.use(
      http.post(REDEEM_URL, () =>
        HttpResponse.json({ data: { paidTicket: 3 }, status: 200, message: "OK" }),
      ),
    );
    renderPage();

    await user.type(await screen.findByLabelText("추천인 닉네임"), "링링");
    await user.click(screen.getByRole("button", { name: "입력하기" }));
    await user.click(await screen.findByRole("button", { name: "확인" }));

    expect(screen.getByText("홈 화면")).toBeInTheDocument();
  });
});
