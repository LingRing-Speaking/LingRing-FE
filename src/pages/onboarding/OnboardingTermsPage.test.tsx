import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { Route, Routes } from "react-router-dom";
import { server } from "@/mocks/server";
import { env } from "@/config/env";
import { useAuthStore } from "@/domains/auth/store";
import { renderWithQueryClient } from "../../../test/utils/renderWithQueryClient";
import { OnboardingTermsPage } from "./OnboardingTermsPage";

const ONBOARDED_USER = {
  id: 1,
  nickname: "tester",
  profileImage: null,
  requiresOnboarding: true,
};

function renderPage() {
  return renderWithQueryClient(
    <Routes>
      <Route path="/onboarding/terms" element={<OnboardingTermsPage />} />
      <Route path="/home" element={<div>홈 화면</div>} />
    </Routes>,
    { user: ONBOARDED_USER, initialEntries: ["/onboarding/terms"] },
  );
}

describe("OnboardingTermsPage", () => {
  it("3개 동의 항목이 모두 미체크 상태로 노출되고 시작 버튼은 비활성화", () => {
    renderPage();

    expect(screen.getByRole("checkbox", { name: "만 14세 이상입니다" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    expect(screen.getByRole("checkbox", { name: "이용약관 동의" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    expect(
      screen.getByRole("checkbox", { name: "개인정보처리방침 동의" }),
    ).toHaveAttribute("aria-checked", "false");

    expect(screen.getByRole("button", { name: "동의하고 시작" })).toBeDisabled();
  });

  it("전체 동의 토글이 3개 모두를 한 번에 체크/해제한다", async () => {
    const user = userEvent.setup();
    renderPage();
    const acceptAll = screen.getByRole("button", { name: /전체 동의/ });

    await user.click(acceptAll);

    expect(screen.getByRole("checkbox", { name: "만 14세 이상입니다" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("button", { name: "동의하고 시작" })).toBeEnabled();

    await user.click(acceptAll);
    expect(screen.getByRole("checkbox", { name: "만 14세 이상입니다" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    expect(screen.getByRole("button", { name: "동의하고 시작" })).toBeDisabled();
  });

  it("3개 모두 체크해야 시작 버튼이 활성화된다", async () => {
    const user = userEvent.setup();
    renderPage();
    const submit = screen.getByRole("button", { name: "동의하고 시작" });

    await user.click(screen.getByRole("checkbox", { name: "만 14세 이상입니다" }));
    expect(submit).toBeDisabled();

    await user.click(screen.getByRole("checkbox", { name: "이용약관 동의" }));
    expect(submit).toBeDisabled();

    await user.click(screen.getByRole("checkbox", { name: "개인정보처리방침 동의" }));
    expect(submit).toBeEnabled();
  });

  it("이용약관·처리방침 '전체보기' 링크는 외부 Notion URL을 새 탭으로 연다", () => {
    renderPage();

    const links = screen.getAllByRole("link", { name: "전체보기" });
    expect(links).toHaveLength(2);
    links.forEach((link) => {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
      expect(link.getAttribute("href")).toMatch(/notion\.site/);
    });
  });

  it("제출에 성공하면 user.requiresOnboarding이 false로 갱신되고 /home으로 이동", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: /전체 동의/ }));
    await user.click(screen.getByRole("button", { name: "동의하고 시작" }));

    await waitFor(() => expect(screen.getByText("홈 화면")).toBeInTheDocument());

    expect(useAuthStore.getState().user?.requiresOnboarding).toBe(false);
  });

  it("제출 실패 시 에러 메시지를 노출하고 /home으로 이동하지 않는다", async () => {
    server.use(
      http.post(`${env.apiBaseUrl}/api/v1/me/agreements`, () =>
        HttpResponse.json(
          { data: null, status: 500, message: "서버에 잠시 문제가 있어요" },
          { status: 500 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: /전체 동의/ }));
    await user.click(screen.getByRole("button", { name: "동의하고 시작" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("서버에 잠시 문제가 있어요"),
    );
    expect(screen.queryByText("홈 화면")).not.toBeInTheDocument();
  });
});
