import { PageShell } from "@/components/PageShell";
import { AppleSignInButton } from "./AppleSignInButton";
import { KakaoSignInButton } from "./KakaoSignInButton";

export function LoginPage() {
  return (
    <PageShell>
      <main className="relative flex flex-1 flex-col bg-white px-6">
        <section className="flex flex-col items-center pt-14">
          <div className="mb-9 flex flex-col items-center gap-1.5">
            <LogoSymbol />
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
            랜덤 매칭으로 대화하고
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
              href="https://shore-crib-2ec.notion.site/35833d3a895c80d8a5a0c87c164591d3"
              target="_blank"
              rel="noopener noreferrer"
            >
              서비스 이용약관
            </a>
            과{" "}
            <a
              className="text-gray-700 underline underline-offset-2"
              href="https://shore-crib-2ec.notion.site/35833d3a895c80aab0abfe8db6dc94d9"
              target="_blank"
              rel="noopener noreferrer"
            >
              개인정보 처리방침
            </a>
            에 동의해요
          </p>
        </section>
      </main>
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
