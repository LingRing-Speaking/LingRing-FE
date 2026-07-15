import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));
vi.mock("../kakao", () => {
  class KakaoLoginUnavailableError extends Error {}
  class KakaoIdTokenMissingError extends Error {}
  return { KakaoLoginUnavailableError, KakaoIdTokenMissingError };
});
vi.mock("../signIn", () => {
  class NicknameRetryExhaustedError extends Error {}
  return { NicknameRetryExhaustedError, signInWithKakao: vi.fn() };
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
import { KakaoLoginUnavailableError } from "../kakao";
import { signInWithKakao } from "../signIn";
import { useKakaoSignIn } from "./useKakaoSignIn";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useKakaoSignIn — Sentry 계측", () => {
  it("분류 불가(unknown) 실패를 Sentry 로 보고한다", async () => {
    const error = new Error("SDK bridge error");
    vi.mocked(signInWithKakao).mockRejectedValue(error);

    const { result } = renderHook(() => useKakaoSignIn());
    await act(async () => {
      await result.current.signIn();
    });

    await waitFor(() => expect(result.current.failure?.kind).toBe("unknown"));
    expect(captureException).toHaveBeenCalledWith(error, {
      tags: { source: "social-login", provider: "kakao" },
    });
  });

  it("예상된 실패(unavailable)는 보고하지 않는다", async () => {
    vi.mocked(signInWithKakao).mockRejectedValue(
      new KakaoLoginUnavailableError(),
    );

    const { result } = renderHook(() => useKakaoSignIn());
    await act(async () => {
      await result.current.signIn();
    });

    await waitFor(() =>
      expect(result.current.failure?.kind).toBe("unavailable"),
    );
    expect(captureException).not.toHaveBeenCalled();
  });
});
