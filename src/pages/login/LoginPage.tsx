import { useRef, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { LEGAL_PRIVACY_POLICY_URL, LEGAL_TERMS_URL } from "@/config/legal";
import { AppleSignInButton } from "./AppleSignInButton";
import { DemoLoginModal } from "./DemoLoginModal";
import { KakaoSignInButton } from "./KakaoSignInButton";

// App Store 리뷰어용 demo 로그인 진입 — 로고를 짧은 시간 안에 5번 연속 탭하면 모달 노출.
const REQUIRED_TAPS = 5;
const TAP_RESET_MS = 1500;

function useLogoTapCounter(onActivate: () => void) {
  const [, setCount] = useState(0);
  const lastTapAtRef = useRef(0);

  return () => {
    const now = Date.now();
    setCount((prev) => {
      const next = now - lastTapAtRef.current > TAP_RESET_MS ? 1 : prev + 1;
      lastTapAtRef.current = now;
      if (next >= REQUIRED_TAPS) {
        onActivate();
        return 0;
      }
      return next;
    });
  };
}

export function LoginPage() {
  const [isDemoOpen, setIsDemoOpen] = useState(false);
  const handleLogoTap = useLogoTapCounter(() => setIsDemoOpen(true));

  return (
    <PageShell>
      <main className="relative flex flex-1 flex-col bg-white px-6">
        <section className="flex flex-col items-center pt-14">
          <div className="mb-9 flex flex-col items-center gap-1.5">
            {/* 로고 5번 연속 탭 → App Review 리뷰어용 데모 로그인 모달 (숨겨진 입구) */}
            <button
              type="button"
              onClick={handleLogoTap}
              aria-label="LingRing 로고"
              className="cursor-default"
            >
              <LogoSymbol />
            </button>
            <span className="text-[30px] font-extrabold tracking-[-0.03em] text-gray-900">
              Ling
              <span className="bg-gradient-to-r from-mint-500 to-coral-500 bg-clip-text text-transparent">
                Ring
              </span>
            </span>
          </div>
          <h1 className="mb-3 text-center text-[24px] font-bold leading-snug tracking-[-0.02em] text-gray-900">
            어색한 영어 회화, 같이 시작해요
          </h1>
          <p className="max-w-[280px] text-center text-[14px] font-medium leading-snug tracking-[-0.01em] text-gray-600">
            학습 파트너와 대화하고
            <br />
            AI 피드백으로 바로 복습해요
          </p>
        </section>

        <section className="mt-auto flex flex-col gap-2.5 pb-8">
          <KakaoSignInButton />
          <AppleSignInButton />
          <p className="mt-3.5 text-center text-[11.5px] font-medium leading-relaxed tracking-[-0.005em] text-gray-500">
            로그인 시{" "}
            <a
              className="text-gray-700 underline underline-offset-2"
              href={LEGAL_TERMS_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              서비스 이용약관
            </a>
            과{" "}
            <a
              className="text-gray-700 underline underline-offset-2"
              href={LEGAL_PRIVACY_POLICY_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              개인정보 처리방침
            </a>
            에 동의해요
          </p>
        </section>
      </main>

      <DemoLoginModal open={isDemoOpen} onClose={() => setIsDemoOpen(false)} />
    </PageShell>
  );
}

function LogoSymbol() {
  return (
    <svg
      viewBox="0 0 64 64"
      role="img"
      aria-label="LingRing 로고"
      className="h-[124px] w-[124px] animate-breathe"
    >
      <defs>
        <linearGradient id="loginGMint" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3ECFA5" />
          <stop offset="100%" stopColor="#10A47A" />
        </linearGradient>
        <linearGradient id="loginGCoral" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFB4A0" />
          <stop offset="100%" stopColor="#F26849" />
        </linearGradient>
      </defs>
      <circle cx="23" cy="32" r="14" fill="none" stroke="url(#loginGMint)" strokeWidth="5.5" />
      <circle cx="41" cy="32" r="14" fill="none" stroke="url(#loginGCoral)" strokeWidth="5.5" />
    </svg>
  );
}
