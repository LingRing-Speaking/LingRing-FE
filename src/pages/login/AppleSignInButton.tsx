import { isAppleSignInSupported } from "@/domains/auth/apple";
import { useAppleSignIn } from "@/domains/auth/hooks/useAppleSignIn";

const APPLE_BG = "#000000";
const APPLE_LABEL = "#FFFFFF";

export function AppleSignInButton() {
  const { signIn, isLoading, failure } = useAppleSignIn();

  // Android·웹에서는 애플 로그인을 제공하지 않으므로 버튼 자체를 렌더하지 않는다.
  if (!isAppleSignInSupported()) return null;

  return (
    <>
      <button
        type="button"
        onClick={signIn}
        disabled={isLoading}
        aria-label="Apple로 로그인"
        style={{ backgroundColor: APPLE_BG, color: APPLE_LABEL }}
        className="flex h-14 w-full items-center justify-center gap-2.5 rounded-[14px] text-[15.5px] font-semibold shadow-[0_6px_18px_rgba(0,0,0,0.06)] transition active:scale-[0.98] active:brightness-95 disabled:opacity-60"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="h-5 w-5">
          <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
        </svg>
        {isLoading ? "로그인 중..." : "Apple로 시작하기"}
      </button>
      {failure && (
        <p role="alert" className="text-center text-[13px] font-medium text-coral-600">
          {failure.message}
        </p>
      )}
    </>
  );
}
