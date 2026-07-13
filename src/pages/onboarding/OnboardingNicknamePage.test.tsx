import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { Route, Routes } from "react-router-dom";
import { server } from "@/mocks/server";
import { renderWithQueryClient } from "../../../test/utils/renderWithQueryClient";
import { OnboardingNicknamePage } from "./OnboardingNicknamePage";

const PROFILE_URL = "http://localhost:3000/api/v1/me/profile";

const NEW_USER = {
  id: 1,
  nickname: "brave-fox-1234",
  profileImage: null,
  requiresOnboarding: false,
};

function renderPage() {
  return renderWithQueryClient(
    <Routes>
      <Route path="/onboarding/nickname" element={<OnboardingNicknamePage />} />
      <Route path="/home" element={<div>홈 화면</div>} />
    </Routes>,
    { user: NEW_USER, initialEntries: ["/onboarding/nickname"] },
  );
}

describe("OnboardingNicknamePage", () => {
  it("빈 입력으로 시작하고 시작하기 버튼은 비활성화, 취소·닫기 수단이 없다", () => {
    renderPage();

    expect(screen.getByLabelText("닉네임")).toHaveValue("");
    expect(screen.getByRole("button", { name: "시작하기" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "취소" })).not.toBeInTheDocument();
  });

  it("1글자 입력 시 길이 에러 + 버튼 비활성화", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText("닉네임"), "a");

    expect(screen.getByText("닉네임은 2~12자여야 해요.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "시작하기" })).toBeDisabled();
  });

  it("허용되지 않는 문자 입력 시 문자셋 에러", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText("닉네임"), "hi!");

    expect(screen.getByText("특수문자나 공백은 사용할 수 없어요.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "시작하기" })).toBeDisabled();
  });

  it("유효 닉네임 제출 시 PATCH /me/profile 호출 후 /home 으로 이동", async () => {
    const user = userEvent.setup();
    let patchedBody: unknown = null;
    server.use(
      http.patch(PROFILE_URL, async ({ request }) => {
        patchedBody = await request.json();
        return HttpResponse.json({
          data: { id: 1, nickname: "링링", profileImage: null },
          status: 200,
          message: "OK",
        });
      }),
    );
    renderPage();

    await user.type(screen.getByLabelText("닉네임"), "링링");
    await user.click(screen.getByRole("button", { name: "시작하기" }));

    await waitFor(() => expect(screen.getByText("홈 화면")).toBeInTheDocument());
    expect(patchedBody).toEqual({ nickname: "링링" });
  });

  it("409 응답 시 중복 안내를 노출하고 /home 으로 이동하지 않는다", async () => {
    server.use(
      http.patch(PROFILE_URL, () =>
        HttpResponse.json(
          { data: null, status: 409, message: "이미 사용 중인 닉네임입니다." },
          { status: 409 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText("닉네임"), "taken");
    await user.click(screen.getByRole("button", { name: "시작하기" }));

    await waitFor(() =>
      expect(screen.getByText("이미 사용 중인 닉네임이에요.")).toBeInTheDocument(),
    );
    expect(screen.queryByText("홈 화면")).not.toBeInTheDocument();
  });
});
