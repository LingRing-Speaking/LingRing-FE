import type * as ReactRouterDom from "react-router-dom";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "@/mocks/server";
import { useAuthStore } from "@/domains/auth/store";
import { renderWithQueryClient } from "../../../test/utils/renderWithQueryClient";
import { WithdrawPage } from "./WithdrawPage";

const navigateMock = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof ReactRouterDom>("react-router-dom");
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock("@capacitor/preferences", () => ({
  Preferences: {
    set: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue({ value: null }),
    remove: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@/domains/auth/kakao", () => ({
  logoutFromKakao: vi.fn().mockResolvedValue(undefined),
}));

beforeEach(() => {
  navigateMock.mockClear();
});

describe("WithdrawPage", () => {
  it("안내 박스·사유 옵션 6개·[탈퇴하기] 버튼을 렌더한다", () => {
    renderWithQueryClient(<WithdrawPage />);

    expect(
      screen.getByText(/탈퇴하면 통화 기록·표현·통계가/),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(6);
    expect(screen.getByRole("button", { name: "탈퇴하기" })).toBeInTheDocument();
  });

  it("사유 미선택 시 [탈퇴하기] 버튼은 disabled", () => {
    renderWithQueryClient(<WithdrawPage />);

    expect(screen.getByRole("button", { name: "탈퇴하기" })).toBeDisabled();
  });

  it("사유 선택 시 [탈퇴하기] 버튼이 활성화되고 모달 노출", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<WithdrawPage />);

    await user.click(screen.getByRole("radio", { name: "잘 사용하지 않아요" }));
    const submitButton = screen.getByRole("button", { name: "탈퇴하기" });
    expect(submitButton).toBeEnabled();

    await user.click(submitButton);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("정말 탈퇴할까요?")).toBeInTheDocument();
  });

  it("모달 [취소] → 모달 닫힘", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<WithdrawPage />);

    await user.click(screen.getByRole("radio", { name: "원하는 기능이 없어요" }));
    await user.click(screen.getByRole("button", { name: "탈퇴하기" }));
    await user.click(screen.getByRole("button", { name: "취소" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("기타 선택 시 textarea가 노출되고, 빈 입력이면 [탈퇴하기]는 여전히 disabled", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<WithdrawPage />);

    await user.click(screen.getByRole("radio", { name: "기타" }));

    const textarea = screen.getByPlaceholderText("어떤 점이 아쉬웠는지 알려주세요");
    expect(textarea).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "탈퇴하기" })).toBeDisabled();
    expect(screen.getByText("0/200")).toBeInTheDocument();
  });

  it("기타 + 공백만 입력은 disabled, 실제 글자가 있으면 활성화된다", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<WithdrawPage />);

    await user.click(screen.getByRole("radio", { name: "기타" }));
    const textarea = screen.getByPlaceholderText("어떤 점이 아쉬웠는지 알려주세요");

    await user.type(textarea, "   ");
    expect(screen.getByRole("button", { name: "탈퇴하기" })).toBeDisabled();

    await user.type(textarea, "혼자 공부가 더 잘 맞아요");
    expect(screen.getByRole("button", { name: "탈퇴하기" })).toBeEnabled();
  });

  it("기타 → 다른 사유로 바꾸면 textarea가 사라지고 버튼은 활성화", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<WithdrawPage />);

    await user.click(screen.getByRole("radio", { name: "기타" }));
    expect(
      screen.getByPlaceholderText("어떤 점이 아쉬웠는지 알려주세요"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "잘 사용하지 않아요" }));

    expect(
      screen.queryByPlaceholderText("어떤 점이 아쉬웠는지 알려주세요"),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "탈퇴하기" })).toBeEnabled();
  });

  it("기타 + 입력 후 탈퇴 → BE body에 description이 trim되어 동봉된다", async () => {
    const user = userEvent.setup();
    let receivedBody: unknown = null;
    server.use(
      http.post(
        "http://localhost:3000/api/v1/me/withdraw",
        async ({ request }) => {
          receivedBody = await request.json();
          return HttpResponse.json({
            data: null,
            status: 204,
            message: "NO_CONTENT",
          });
        },
      ),
    );

    renderWithQueryClient(<WithdrawPage />);

    await user.click(screen.getByRole("radio", { name: "기타" }));
    await user.type(
      screen.getByPlaceholderText("어떤 점이 아쉬웠는지 알려주세요"),
      "  자유 입력 사유  ",
    );
    await user.click(screen.getByRole("button", { name: "탈퇴하기" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "탈퇴하기" }));

    await waitFor(() => {
      expect(receivedBody).toEqual({
        reason: "OTHER",
        description: "자유 입력 사유",
      });
      expect(navigateMock).toHaveBeenCalledWith("/login", { replace: true });
    });
  });

  it("모달 [탈퇴하기] → BE 호출(reason body 포함) + 로컬 정리 + /login replace", async () => {
    const user = userEvent.setup();
    let receivedBody: unknown = null;
    server.use(
      http.post(
        "http://localhost:3000/api/v1/me/withdraw",
        async ({ request }) => {
          receivedBody = await request.json();
          return HttpResponse.json({
            data: null,
            status: 204,
            message: "NO_CONTENT",
          });
        },
      ),
    );

    renderWithQueryClient(<WithdrawPage />);

    await user.click(screen.getByRole("radio", { name: "매칭이 잘 안 돼요" }));
    await user.click(screen.getByRole("button", { name: "탈퇴하기" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "탈퇴하기" }));

    await waitFor(() => {
      expect(receivedBody).toEqual({ reason: "NO_GOOD_MATCH" });
      expect(navigateMock).toHaveBeenCalledWith("/login", { replace: true });
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });
  });

  it("BE 호출 실패 시 모달 안에 에러 메시지 표시 + 로컬 세션 유지 + 재시도 가능", async () => {
    const user = userEvent.setup();
    server.use(
      http.post("http://localhost:3000/api/v1/me/withdraw", () =>
        HttpResponse.json(
          { data: null, status: 500, message: "INTERNAL" },
          { status: 500 },
        ),
      ),
    );

    renderWithQueryClient(<WithdrawPage />, {
      user: { id: 1, nickname: "tester" },
    });

    await user.click(screen.getByRole("radio", { name: "원하는 기능이 없어요" }));
    await user.click(screen.getByRole("button", { name: "탈퇴하기" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "탈퇴하기" }));

    await waitFor(() => {
      expect(within(dialog).getByRole("alert")).toBeInTheDocument();
    });
    expect(navigateMock).not.toHaveBeenCalledWith("/login", { replace: true });
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(within(dialog).getByRole("button", { name: "탈퇴하기" })).toBeEnabled();
  });

  it("뒤로가기 버튼 → navigate(-1)", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<WithdrawPage />);

    await user.click(screen.getByRole("button", { name: "뒤로가기" }));

    expect(navigateMock).toHaveBeenCalledWith(-1);
  });
});
