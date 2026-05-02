import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageShell } from "@/components/PageShell";
import { signOut } from "@/domains/auth/signOut";
import { LogoutConfirmModal } from "./LogoutConfirmModal";

const APP_VERSION = "1.0.0";

export function SettingsPage() {
  const navigate = useNavigate();
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut();
      navigate("/login", { replace: true });
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <PageShell>
      <main className="relative flex flex-1 flex-col bg-gray-50">
        <div className="relative flex h-[52px] items-center bg-white px-2">
          <button
            type="button"
            aria-label="뒤로가기"
            onClick={() => navigate(-1)}
            className="flex h-10 w-10 items-center justify-center rounded-full text-gray-900 transition-colors active:bg-gray-100"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <h1 className="absolute left-1/2 -translate-x-1/2 text-[17px] font-bold tracking-tight text-gray-900">
            설정
          </h1>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-8 pt-2">
          <h2 className="mx-1 mb-2.5 mt-5 text-[13px] font-bold tracking-tight text-gray-600">
            계정
          </h2>
          <div className="overflow-hidden rounded-[18px] bg-white shadow-card">
            <button
              type="button"
              onClick={() => setIsLogoutModalOpen(true)}
              className="flex min-h-[52px] w-full items-center justify-between gap-3 px-[18px] py-[15px] text-left transition-colors active:bg-gray-50"
            >
              <span className="flex-1 text-[15px] font-medium tracking-tight text-gray-900">
                로그아웃
              </span>
            </button>
          </div>

          <p className="mb-2 mt-8 text-center text-[12.5px] font-medium tracking-tight tabular-nums text-gray-400">
            LingRing {APP_VERSION}
          </p>
        </div>
      </main>

      <LogoutConfirmModal
        open={isLogoutModalOpen}
        loading={isLoggingOut}
        onClose={() => setIsLogoutModalOpen(false)}
        onConfirm={handleLogout}
      />
    </PageShell>
  );
}
