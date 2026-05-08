import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type * as ReactRouterDom from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "@/mocks/server";
import { useAuthStore } from "@/domains/auth/store";
import { renderWithQueryClient } from "../../../test/utils/renderWithQueryClient";
import { DemoLoginModal } from "./DemoLoginModal";

const DEMO_LOGIN_URL = "http://localhost:3000/api/v1/auth/demo-login";

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

const noop = () => undefined;

const okDemoLogin = (
  overrides?: Partial<{ requiresOnboarding: boolean; nickname: string }>,
) =>
  HttpResponse.json({
    data: {
      accessToken: "demo-access",
      refreshToken: "demo-refresh",
      user: {
        id: 999,
        nickname: overrides?.nickname ?? "Reviewer A",
        profileImage: null,
        requiresOnboarding: overrides?.requiresOnboarding ?? false,
      },
    },
    status: 200,
    message: "OK",
  });

describe("DemoLoginModal", () => {
  beforeEach(() => {
    navigateMock.mockClear();
  });

  it("open=false 면 아무것도 렌더하지 않는다", () => {
    const { container } = renderWithQueryClient(
      <DemoLoginModal open={false} onClose={noop} />,
      { user: null },
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("open=true 면 토큰 입력창과 버튼이 노출된다", () => {
    renderWithQueryClient(<DemoLoginModal open onClose={noop} />, { user: null });
    expect(screen.getByRole("dialog", { name: "데모 로그인" })).toBeInTheDocument();
    expect(screen.getByLabelText("데모 토큰")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "로그인" })).toBeInTheDocument();
  });

  it("토큰이 비어있으면 로그인 버튼이 비활성화", () => {
    renderWithQueryClient(<DemoLoginModal open onClose={noop} />, { user: null });
    expect(screen.getByRole("button", { name: "로그인" })).toBeDisabled();
  });

  it("유효 토큰 제출 시 store 갱신 + /home 으로 navigate", async () => {
    server.use(http.post(DEMO_LOGIN_URL, () => okDemoLogin()));
    const user = userEvent.setup();
    renderWithQueryClient(<DemoLoginModal open onClose={noop} />, { user: null });

    await user.type(screen.getByLabelText("데모 토큰"), "review-token-A");
    await user.click(screen.getByRole("button", { name: "로그인" }));

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith("/home", { replace: true });
    });
    const state = useAuthStore.getState();
    expect(state.accessToken).toBe("demo-access");
    expect(state.user?.nickname).toBe("Reviewer A");
    expect(state.isAuthenticated).toBe(true);
  });

  it("user.requiresOnboarding=true 면 /onboarding/terms 로 navigate", async () => {
    server.use(
      http.post(DEMO_LOGIN_URL, () => okDemoLogin({ requiresOnboarding: true })),
    );
    const user = userEvent.setup();
    renderWithQueryClient(<DemoLoginModal open onClose={noop} />, { user: null });

    await user.type(screen.getByLabelText("데모 토큰"), "review-token-A");
    await user.click(screen.getByRole("button", { name: "로그인" }));

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith("/onboarding/terms", { replace: true });
    });
  });

  it("토큰 불일치(401) 시 친절한 메시지가 alert 으로 노출되고 navigate 안 함", async () => {
    server.use(
      http.post(DEMO_LOGIN_URL, () =>
        HttpResponse.json(
          { data: null, status: 401, message: "INVALID_DEMO_TOKEN" },
          { status: 401 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderWithQueryClient(<DemoLoginModal open onClose={noop} />, { user: null });

    await user.type(screen.getByLabelText("데모 토큰"), "wrong-token");
    await user.click(screen.getByRole("button", { name: "로그인" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("토큰이 일치하지 않아요");
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("취소 버튼 클릭 시 onClose 가 호출된다", async () => {
    let closed = 0;
    const user = userEvent.setup();
    renderWithQueryClient(
      <DemoLoginModal open onClose={() => (closed += 1)} />,
      { user: null },
    );
    await user.click(screen.getByRole("button", { name: "취소" }));
    expect(closed).toBe(1);
  });
});
