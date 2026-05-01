import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { SplashScreen } from "@capacitor/splash-screen";
import { PageShell } from "@/components/PageShell";
import { restoreSession } from "@/domains/auth/sessionRestore";

const SPLASH_MIN_MS = 1500;
const FADE_OUT_MS = 280;
const LOGO_BREATHE_DELAY_MS = 700;

export function SplashPage() {
  const navigate = useNavigate();
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      void SplashScreen.hide();
    }

    let cancelled = false;
    const fadeTimers: number[] = [];

    Promise.all([
      restoreSession(),
      new Promise<void>((resolve) => {
        fadeTimers.push(window.setTimeout(resolve, SPLASH_MIN_MS));
      }),
    ]).then(([result]) => {
      if (cancelled) return;
      setLeaving(true);
      fadeTimers.push(
        window.setTimeout(() => {
          if (cancelled) return;
          navigate(result.kind === "restored" ? "/home" : "/login", { replace: true });
        }, FADE_OUT_MS),
      );
    });

    return () => {
      cancelled = true;
      fadeTimers.forEach((id) => window.clearTimeout(id));
    };
  }, [navigate]);

  return (
    <PageShell>
      <main className="flex flex-1 items-center justify-center bg-white">
        <div className={leaving ? "animate-splash-leave" : "animate-splash-enter"}>
          <div className="flex flex-col items-center gap-1.5">
            <LogoSymbol />
            <span className="text-[30px] font-extrabold leading-none tracking-[-0.03em] text-gray-900">
              Ling
              <span className="bg-gradient-to-r from-mint-500 to-coral-500 bg-clip-text text-transparent">
                Ring
              </span>
            </span>
          </div>
        </div>
      </main>
    </PageShell>
  );
}

function LogoSymbol() {
  return (
    <svg
      viewBox="0 0 64 64"
      role="img"
      aria-label="LingRing"
      className="h-[124px] w-[124px] animate-breathe"
      style={{ animationDelay: `${LOGO_BREATHE_DELAY_MS}ms` }}
    >
      <defs>
        <linearGradient id="splashGMint" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3ECFA5" />
          <stop offset="100%" stopColor="#10A47A" />
        </linearGradient>
        <linearGradient id="splashGCoral" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFB4A0" />
          <stop offset="100%" stopColor="#F26849" />
        </linearGradient>
      </defs>
      <circle cx="23" cy="32" r="14" fill="none" stroke="url(#splashGMint)" strokeWidth="5.5" />
      <circle cx="41" cy="32" r="14" fill="none" stroke="url(#splashGCoral)" strokeWidth="5.5" />
    </svg>
  );
}
