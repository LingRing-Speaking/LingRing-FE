import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type * as ReactRouterDom from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { server } from "@/mocks/server";
import { renderWithQueryClient } from "../../../test/utils/renderWithQueryClient";
import { SettingsPage } from "./SettingsPage";

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

describe("SettingsPage", () => {
  it("로그아웃·탈퇴하기 행과 버전 텍스트를 렌더한다", () => {
    renderWithQueryClient(<SettingsPage />);

    expect(screen.getByRole("button", { name: "로그아웃" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "탈퇴하기" })).toBeInTheDocument();
    expect(screen.getByText("LingRing 1.0.0")).toBeInTheDocument();
  });

  it("도움말 그룹에 문의하기·이용약관·개인정보처리방침 링크를 노출한다", () => {
    renderWithQueryClient(<SettingsPage />);

    const supportLink = screen.getByRole("link", { name: /문의하기/ });
    expect(supportLink).toHaveAttribute("href", "mailto:spqjekdl1004@naver.com");
    expect(supportLink).not.toHaveAttribute("target");

    const termsLink = screen.getByRole("link", { name: /이용약관/ });
    expect(termsLink.getAttribute("href")).toMatch(/notion\.site/);
    expect(termsLink).toHaveAttribute("target", "_blank");
    expect(termsLink).toHaveAttribute("rel", "noopener noreferrer");

    const privacyLink = screen.getByRole("link", { name: /개인정보처리방침/ });
    expect(privacyLink.getAttribute("href")).toMatch(/notion\.site/);
    expect(privacyLink).toHaveAttribute("target", "_blank");
    expect(privacyLink).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("탈퇴하기 행 클릭 → /settings/withdraw 로 이동", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<SettingsPage />);

    await user.click(screen.getByRole("button", { name: "탈퇴하기" }));

    expect(navigateMock).toHaveBeenCalledWith("/settings/withdraw");
  });

  it("뒤로가기 버튼을 누르면 navigate(-1)이 호출된다", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<SettingsPage />);

    await user.click(screen.getByRole("button", { name: "뒤로가기" }));

    expect(navigateMock).toHaveBeenCalledWith(-1);
  });

  it("로그아웃 행 클릭 → 확인 모달이 노출된다", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<SettingsPage />);

    await user.click(screen.getByRole("button", { name: "로그아웃" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("정말 로그아웃 할까요?")).toBeInTheDocument();
  });

  it("모달 [닫기] 버튼을 누르면 모달이 사라진다", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<SettingsPage />);

    await user.click(screen.getByRole("button", { name: "로그아웃" }));
    await user.click(screen.getByRole("button", { name: "닫기" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("모달 [로그아웃] 확정 → BE 호출 + /login 으로 replace 이동", async () => {
    const user = userEvent.setup();
    let logoutCalled = false;
    server.use(
      http.post("http://localhost:3000/api/v1/auth/logout", () => {
        logoutCalled = true;
        return HttpResponse.json({
          data: null,
          status: 204,
          message: "NO_CONTENT",
        });
      }),
    );

    renderWithQueryClient(<SettingsPage />);

    await user.click(screen.getByRole("button", { name: "로그아웃" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "로그아웃" }));

    await waitFor(() => {
      expect(logoutCalled).toBe(true);
      expect(navigateMock).toHaveBeenCalledWith("/login", { replace: true });
    });
  });

  it("BE 호출이 실패해도 /login 으로 이동한다", async () => {
    const user = userEvent.setup();
    server.use(
      http.post("http://localhost:3000/api/v1/auth/logout", () =>
        HttpResponse.json(
          { data: null, status: 500, message: "INTERNAL" },
          { status: 500 },
        ),
      ),
    );

    renderWithQueryClient(<SettingsPage />);

    await user.click(screen.getByRole("button", { name: "로그아웃" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "로그아웃" }));

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith("/login", { replace: true });
    });
  });
});
