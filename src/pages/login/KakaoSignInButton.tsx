import { useKakaoSignIn } from "@/domains/auth/hooks/useKakaoSignIn";

const KAKAO_BG = "#FEE500";
const KAKAO_LABEL = "#191600";

export function KakaoSignInButton() {
  const { signIn, isLoading, failure } = useKakaoSignIn();

  return (
    <>
      <button
        type="button"
        onClick={signIn}
        disabled={isLoading}
        aria-label="카카오로 로그인"
        style={{ backgroundColor: KAKAO_BG, color: KAKAO_LABEL }}
        className="flex h-14 w-full items-center justify-center gap-2.5 rounded-[14px] text-[15.5px] font-semibold shadow-[0_6px_18px_rgba(0,0,0,0.06)] transition active:scale-[0.98] active:brightness-95 disabled:opacity-60"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="h-5 w-5">
          <path d="M12 3C6.48 3 2 6.58 2 11c0 2.86 1.88 5.37 4.73 6.78-.21.77-.76 2.79-.87 3.22-.14.53.19.52.4.38.17-.11 2.69-1.83 3.77-2.56.64.09 1.3.13 1.97.13 5.52 0 10-3.58 10-8s-4.48-8-10-8z" />
        </svg>
        {isLoading ? "로그인 중..." : "카카오로 시작하기"}
      </button>
      {failure && (
        <p role="alert" className="text-center text-[13px] font-medium text-coral-600">
          {failure.message}
        </p>
      )}
    </>
  );
}
