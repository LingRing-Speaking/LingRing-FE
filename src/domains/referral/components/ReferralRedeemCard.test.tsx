import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { server } from "@/mocks/server";
import { renderWithQueryClient } from "../../../../test/utils/renderWithQueryClient";
import { ReferralRedeemCard } from "./ReferralRedeemCard";

const REDEEM_URL = "http://localhost:3000/api/v1/me/referral/redeem";

function renderCard() {
  const onClose = vi.fn();
  renderWithQueryClient(<ReferralRedeemCard closeLabel="건너뛰기" onClose={onClose} />);
  return { onClose };
}

describe("ReferralRedeemCard", () => {
  it("빈 입력이면 입력하기 버튼이 비활성화된다", async () => {
    const user = userEvent.setup();
    renderCard();

    expect(screen.getByRole("button", { name: "입력하기" })).toBeDisabled();

    await user.type(screen.getByLabelText("추천인 닉네임"), "   ");
    expect(screen.getByRole("button", { name: "입력하기" })).toBeDisabled();
  });

  // FE 랜덤 생성 시절 닉네임(brave-tiger-1234)은 현재 닉네임 규칙에 맞지 않지만 추천인으로 유효하다.
  it("닉네임 규칙과 무관하게 앞뒤 공백만 제거해 제출한다", async () => {
    const user = userEvent.setup();
    let receivedBody: unknown = null;
    server.use(
      http.post(REDEEM_URL, async ({ request }) => {
        receivedBody = await request.json();
        return HttpResponse.json({ data: { paidTicket: 3 }, status: 200, message: "OK" });
      }),
    );
    renderCard();

    await user.type(screen.getByLabelText("추천인 닉네임"), "  brave-tiger-1234 ");
    await user.click(screen.getByRole("button", { name: "입력하기" }));

    await waitFor(() => expect(receivedBody).toEqual({ nickname: "brave-tiger-1234" }));
  });

  it("입력 성공 시 지급 안내를 보여주고, 확인을 누르면 onClose 를 호출한다", async () => {
    const user = userEvent.setup();
    server.use(
      http.post(REDEEM_URL, () =>
        HttpResponse.json({ data: { paidTicket: 3 }, status: 200, message: "OK" }),
      ),
    );
    const { onClose } = renderCard();

    await user.type(screen.getByLabelText("추천인 닉네임"), "링링");
    await user.click(screen.getByRole("button", { name: "입력하기" }));

    expect(await screen.findByText("황금티켓 3장을 받았어요")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "확인" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("실패 응답이면 사유별 문구를 보여주고 입력 화면에 머문다", async () => {
    const user = userEvent.setup();
    server.use(
      http.post(REDEEM_URL, () =>
        HttpResponse.json(
          { data: null, status: 400, message: "자기 자신", code: "REFERRAL_SELF_NOT_ALLOWED" },
          { status: 400 },
        ),
      ),
    );
    renderCard();

    await user.type(screen.getByLabelText("추천인 닉네임"), "tester");
    await user.click(screen.getByRole("button", { name: "입력하기" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("내 닉네임은 입력할 수 없어요.");
    expect(screen.getByLabelText("추천인 닉네임")).toBeInTheDocument();
  });

  it("입력을 고치면 이전 실패 문구가 사라진다", async () => {
    const user = userEvent.setup();
    server.use(
      http.post(REDEEM_URL, () =>
        HttpResponse.json(
          { data: null, status: 404, message: "없음", code: "REFERRER_NOT_FOUND" },
          { status: 404 },
        ),
      ),
    );
    renderCard();

    await user.type(screen.getByLabelText("추천인 닉네임"), "없는사람");
    await user.click(screen.getByRole("button", { name: "입력하기" }));
    await screen.findByRole("alert");

    await user.type(screen.getByLabelText("추천인 닉네임"), "2");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("닫기 버튼은 전달받은 라벨로 보이고 누르면 onClose 를 호출한다", async () => {
    const user = userEvent.setup();
    const { onClose } = renderCard();

    await user.click(screen.getByRole("button", { name: "건너뛰기" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("마감일을 주면 닫기 대신 마감일까지 입력할 수 있다고 안내하고, 확인을 누르면 onClose 를 호출한다", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithQueryClient(
      <ReferralRedeemCard
        closeLabel="건너뛰기"
        onClose={onClose}
        skipNoticeUntil="2026-01-05T09:30:00"
      />,
    );

    await user.click(screen.getByRole("button", { name: "건너뛰기" }));

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText(/1월 5일까지/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "확인" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
