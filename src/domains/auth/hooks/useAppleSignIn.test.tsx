import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));
vi.mock("../apple", () => {
  class AppleLoginUnavailableError extends Error {}
  class AppleIdentityTokenMissingError extends Error {}
  return { AppleLoginUnavailableError, AppleIdentityTokenMissingError };
});
vi.mock("../signIn", () => {
  class NicknameRetryExhaustedError extends Error {}
  return { NicknameRetryExhaustedError, signInWithApple: vi.fn() };
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

import { captureException } from "@/lib/sentry";
import { AppleLoginUnavailableError } from "../apple";
import { signInWithApple } from "../signIn";
import { useAppleSignIn } from "./useAppleSignIn";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useAppleSignIn — Sentry 계측", () => {
  it("분류 불가(unknown) 실패를 Sentry 로 보고한다", async () => {
    const error = new Error("authorize bridge error");
    vi.mocked(signInWithApple).mockRejectedValue(error);

    const { result } = renderHook(() => useAppleSignIn());
    await act(async () => {
      await result.current.signIn();
    });

    await waitFor(() => expect(result.current.failure?.kind).toBe("unknown"));
    expect(captureException).toHaveBeenCalledWith(error, {
      tags: { source: "social-login", provider: "apple" },
    });
  });

  it("예상된 실패(unavailable)는 보고하지 않는다", async () => {
    vi.mocked(signInWithApple).mockRejectedValue(
      new AppleLoginUnavailableError(),
    );

    const { result } = renderHook(() => useAppleSignIn());
    await act(async () => {
      await result.current.signIn();
    });

    await waitFor(() =>
      expect(result.current.failure?.kind).toBe("unavailable"),
    );
    expect(captureException).not.toHaveBeenCalled();
  });
});
