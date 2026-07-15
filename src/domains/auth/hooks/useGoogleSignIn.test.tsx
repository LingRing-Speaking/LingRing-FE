import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));
vi.mock("../google", () => {
  class GoogleLoginUnavailableError extends Error {}
  class GoogleIdTokenMissingError extends Error {}
  return { GoogleLoginUnavailableError, GoogleIdTokenMissingError };
});
vi.mock("../signIn", () => {
  class NicknameRetryExhaustedError extends Error {}
  return { NicknameRetryExhaustedError, signInWithGoogle: vi.fn() };
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
import { GoogleLoginUnavailableError } from "../google";
import { signInWithGoogle } from "../signIn";
import { useGoogleSignIn } from "./useGoogleSignIn";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useGoogleSignIn — Sentry 계측", () => {
  it("분류 불가(unknown) 실패를 Sentry 로 보고한다", async () => {
    // #218 Android QA 의 SocialLogin scopes 에러가 정확히 이 분기로 삼켜졌다.
    const error = new Error(
      "You CANNOT use scopes without modifying the main activity.",
    );
    vi.mocked(signInWithGoogle).mockRejectedValue(error);

    const { result } = renderHook(() => useGoogleSignIn());
    await act(async () => {
      await result.current.signIn();
    });

    await waitFor(() => expect(result.current.failure?.kind).toBe("unknown"));
    expect(captureException).toHaveBeenCalledWith(error, {
      tags: { source: "social-login", provider: "google" },
    });
  });

  it("예상된 실패(unavailable)는 보고하지 않는다", async () => {
    vi.mocked(signInWithGoogle).mockRejectedValue(
      new GoogleLoginUnavailableError(),
    );

    const { result } = renderHook(() => useGoogleSignIn());
    await act(async () => {
      await result.current.signIn();
    });

    await waitFor(() =>
      expect(result.current.failure?.kind).toBe("unavailable"),
    );
    expect(captureException).not.toHaveBeenCalled();
  });
});
