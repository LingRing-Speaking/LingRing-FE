import { useGoogleSignIn } from "@/domains/auth/hooks/useGoogleSignIn";

// 구글 브랜드 가이드라인의 라이트 테마 버튼 색 (흰 배경 + 회색 테두리 + 짙은 라벨)
const GOOGLE_BG = "#FFFFFF";
const GOOGLE_LABEL = "#1F1F1F";
const GOOGLE_BORDER = "#DADCE0";

export function GoogleSignInButton() {
  const { signIn, isLoading, failure } = useGoogleSignIn();

  return (
    <>
      <button
        type="button"
        onClick={signIn}
        disabled={isLoading}
        aria-label="Google로 로그인"
        style={{
          backgroundColor: GOOGLE_BG,
          color: GOOGLE_LABEL,
          border: `1px solid ${GOOGLE_BORDER}`,
        }}
        className="flex h-14 w-full items-center justify-center gap-2.5 rounded-[14px] text-[15.5px] font-semibold shadow-[0_6px_18px_rgba(0,0,0,0.06)] transition active:scale-[0.98] active:brightness-95 disabled:opacity-60"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
        {isLoading ? "로그인 중..." : "Google로 시작하기"}
      </button>
      {failure && (
        <p role="alert" className="text-center text-[13px] font-medium text-coral-600">
          {failure.message}
        </p>
      )}
    </>
  );
}
