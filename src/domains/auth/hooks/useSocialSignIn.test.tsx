import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigate = vi.fn();
vi.mock("react-router-dom", () => ({
  useNavigate: () => navigate,
}));
vi.mock("../signIn", () => {
  class RejoinConfirmationRequiredError extends Error {
    constructor(public readonly pendingSignIn: unknown) {
      super("rejoin");
    }
  }
  return { RejoinConfirmationRequiredError, confirmRejoin: vi.fn() };
});
vi.mock("../storage", () => ({ saveTokens: vi.fn() }));
vi.mock("../store", () => ({
  useAuthStore: (selector: (s: unknown) => unknown) =>
    selector({ setSession: vi.fn() }),
}));
vi.mock("@/domains/onboarding/needsAgreement", () => ({
  needsAgreement: () => false,
}));
vi.mock("@/lib/sentry", () => ({ captureException: vi.fn() }));

import { RejoinConfirmationRequiredError, confirmRejoin } from "../signIn";
import { useSocialSignIn } from "./useSocialSignIn";

const SUCCESS_RESPONSE = {
  accessToken: "access-jwt",
  refreshToken: "refresh-jwt",
  user: { id: 1, nickname: "링링", profileImage: null },
};
const PENDING_SIGN_IN = { provider: "google" as const, idToken: "google-id-jwt" };

const classify = (err: unknown) => ({ kind: "api" as const, message: String(err) });

function renderSocialSignIn(signIn: () => Promise<typeof SUCCESS_RESPONSE>) {
  return renderHook(() => useSocialSignIn({ provider: "google", signIn, classify }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useSocialSignIn — 탈퇴 회원 재가입 확인", () => {
  it("재가입 확인이 필요하면 실패 대신 rejoinPrompt 를 연다", async () => {
    const signIn = vi.fn().mockRejectedValue(new RejoinConfirmationRequiredError(PENDING_SIGN_IN));

    const { result } = renderSocialSignIn(signIn);
    await act(() => result.current.signIn());

    expect(result.current.rejoinPrompt).not.toBeNull();
    expect(result.current.failure).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("확인하면 보류된 로그인으로 재가입하고 화면을 이동한다", async () => {
    const signIn = vi.fn().mockRejectedValue(new RejoinConfirmationRequiredError(PENDING_SIGN_IN));
    vi.mocked(confirmRejoin).mockResolvedValue(SUCCESS_RESPONSE);

    const { result } = renderSocialSignIn(signIn);
    await act(() => result.current.signIn());
    await act(() => result.current.rejoinPrompt!.confirm());

    expect(confirmRejoin).toHaveBeenCalledWith(PENDING_SIGN_IN);
    expect(signIn).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith("/home", { replace: true });
  });

  it("재가입 요청이 실패하면 모달을 닫고 실패를 노출한다", async () => {
    const signIn = vi.fn().mockRejectedValue(new RejoinConfirmationRequiredError(PENDING_SIGN_IN));
    vi.mocked(confirmRejoin).mockRejectedValue(new Error("boom"));

    const { result } = renderSocialSignIn(signIn);
    await act(() => result.current.signIn());
    await act(() => result.current.rejoinPrompt!.confirm());

    expect(result.current.rejoinPrompt).toBeNull();
    expect(result.current.failure).toEqual({ kind: "api", message: "Error: boom" });
  });

  it("취소하면 재가입 없이 모달만 닫는다", async () => {
    const signIn = vi.fn().mockRejectedValue(new RejoinConfirmationRequiredError(PENDING_SIGN_IN));

    const { result } = renderSocialSignIn(signIn);
    await act(() => result.current.signIn());
    act(() => result.current.rejoinPrompt!.cancel());

    expect(result.current.rejoinPrompt).toBeNull();
    expect(confirmRejoin).not.toHaveBeenCalled();
  });
});
