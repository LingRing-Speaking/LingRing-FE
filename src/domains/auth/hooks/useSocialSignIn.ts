import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { captureException } from "@/lib/sentry";
import { needsAgreement } from "@/domains/onboarding/needsAgreement";
import {
  RejoinConfirmationRequiredError,
  confirmRejoin,
  type SocialSignInInput,
} from "../signIn";
import { saveTokens } from "../storage";
import { useAuthStore } from "../store";
import type { SocialLoginResponse, SocialProvider } from "../types";

export interface RejoinPrompt {
  confirm: () => Promise<void>;
  cancel: () => void;
}

interface UseSocialSignInOptions<F> {
  provider: SocialProvider;
  signIn: () => Promise<SocialLoginResponse>;
  classify: (err: unknown) => F;
}

export interface UseSocialSignInResult<F> {
  signIn: () => Promise<void>;
  isLoading: boolean;
  failure: F | null;
  /** 최근 탈퇴한 계정이라 재가입 확인을 기다리는 중이면 non-null. */
  rejoinPrompt: RejoinPrompt | null;
}

/**
 * 소셜 로그인 공통 흐름 — 세션 저장·라우팅, 실패 분류, 탈퇴 회원 재가입 확인.
 * provider 별 차이(SDK 호출, 실패 문구)는 `signIn`·`classify` 로 주입받는다.
 */
export function useSocialSignIn<F extends { kind: string }>({
  provider,
  signIn,
  classify,
}: UseSocialSignInOptions<F>): UseSocialSignInResult<F> {
  const setSession = useAuthStore((state) => state.setSession);
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [failure, setFailure] = useState<F | null>(null);
  const [pendingSignIn, setPendingSignIn] = useState<SocialSignInInput | null>(null);

  const run = useCallback(
    async (attempt: () => Promise<SocialLoginResponse>) => {
      setIsLoading(true);
      setFailure(null);
      try {
        const result = await attempt();
        await saveTokens({
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
        });
        setSession({
          user: result.user,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
        });
        const next = needsAgreement(result.user) ? "/onboarding/terms" : "/home";
        navigate(next, { replace: true });
      } catch (err) {
        if (err instanceof RejoinConfirmationRequiredError) {
          setPendingSignIn(err.pendingSignIn);
          return;
        }
        const failure = classify(err);
        // 분류 불가(unknown) = SDK·브릿지의 예상 밖 실패 — 무신호로 두지 않는다.
        // #218 Android QA 의 SocialLogin scopes 에러가 정확히 이 분기로 삼켜졌다.
        if (failure.kind === "unknown") {
          captureException(err, {
            tags: { source: "social-login", provider },
          });
        }
        setFailure(failure);
      } finally {
        setIsLoading(false);
      }
    },
    [classify, navigate, provider, setSession],
  );

  const startSignIn = useCallback(() => run(signIn), [run, signIn]);

  const confirm = useCallback(async () => {
    if (!pendingSignIn) return;
    await run(() => confirmRejoin(pendingSignIn));
    // 실패하면 모달을 닫고 버튼 아래에 실패 문구를 보인다. 성공 시엔 이미 화면을 떠났다.
    setPendingSignIn(null);
  }, [pendingSignIn, run]);

  const cancel = useCallback(() => setPendingSignIn(null), []);

  return {
    signIn: startSignIn,
    isLoading,
    failure,
    rejoinPrompt: pendingSignIn ? { confirm, cancel } : null,
  };
}
