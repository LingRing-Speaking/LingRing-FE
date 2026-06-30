import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageShell } from "@/components/PageShell";
import {
  LEGAL_PRIVACY_POLICY_URL,
  LEGAL_TERMS_URL,
  LEGAL_TERMS_VERSION,
} from "@/config/legal";
import { useAcceptOnboarding } from "@/domains/onboarding/hooks/useAcceptOnboarding";
import type { AgreementItem } from "@/domains/onboarding/api/postAgreement";

interface AgreementOption {
  key: AgreementItem;
  label: string;
  externalUrl?: string;
}

const AGREEMENTS: AgreementOption[] = [
  { key: "over14", label: "만 14세 이상입니다" },
  { key: "terms", label: "이용약관 동의", externalUrl: LEGAL_TERMS_URL },
  { key: "privacy", label: "개인정보처리방침 동의", externalUrl: LEGAL_PRIVACY_POLICY_URL },
  { key: "voice_ai", label: "통화 녹음·AI 분석 동의", externalUrl: LEGAL_PRIVACY_POLICY_URL },
];

const GENERIC_ERROR_MESSAGE = "잠시 후 다시 시도해주세요.";

export function OnboardingTermsPage() {
  const navigate = useNavigate();
  const acceptOnboarding = useAcceptOnboarding();
  const [checked, setChecked] = useState<Record<AgreementItem, boolean>>({
    over14: false,
    terms: false,
    privacy: false,
    voice_ai: false,
  });

  const allChecked = useMemo(
    () => AGREEMENTS.every(({ key }) => checked[key]),
    [checked],
  );

  const toggleOne = (key: AgreementItem) => {
    setChecked((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleAll = () => {
    const next = !allChecked;
    setChecked({ over14: next, terms: next, privacy: next, voice_ai: next });
  };

  const handleSubmit = () => {
    if (!allChecked || acceptOnboarding.isPending) return;
    acceptOnboarding.mutate(
      {
        termsVersion: LEGAL_TERMS_VERSION,
        agreedItems: AGREEMENTS.map(({ key }) => key),
      },
      {
        onSuccess: () => navigate("/home", { replace: true }),
      },
    );
  };

  const errorMessage = (() => {
    if (!acceptOnboarding.isError) return null;
    const apiMessage = acceptOnboarding.error?.message;
    return apiMessage && apiMessage.length > 0 ? apiMessage : GENERIC_ERROR_MESSAGE;
  })();

  return (
    <PageShell>
      <main className="relative flex flex-1 flex-col bg-gray-50">
        <header className="flex h-[52px] shrink-0 items-center justify-center bg-white px-2">
          <h1 className="text-[17px] font-bold tracking-tight text-gray-900">
            링링 시작 전에 확인해주세요
          </h1>
        </header>

        <div className="flex-1 overflow-y-auto px-5 pb-[140px] pt-6">
          <p className="mb-5 text-[14px] font-medium leading-relaxed tracking-tight text-gray-600">
            아래 항목에 모두 동의해야 서비스를 이용할 수 있어요.
          </p>

          <button
            type="button"
            onClick={toggleAll}
            aria-pressed={allChecked}
            className="mb-3 flex w-full items-center gap-3 rounded-[14px] bg-white px-[18px] py-4 text-left shadow-card active:bg-gray-50"
          >
            <CheckMark checked={allChecked} />
            <span className="text-[15px] font-bold tracking-tight text-gray-900">
              전체 동의
            </span>
          </button>

          <ul className="overflow-hidden rounded-[18px] bg-white shadow-card" role="list">
            {AGREEMENTS.map(({ key, label, externalUrl }, index) => (
              <li
                key={key}
                className={`flex items-center gap-3 px-[18px] py-[14px] ${
                  index > 0 ? "border-t border-gray-100" : ""
                }`}
              >
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={checked[key]}
                  aria-label={label}
                  onClick={() => toggleOne(key)}
                  className="flex flex-1 items-center gap-3 text-left active:opacity-80"
                >
                  <CheckMark checked={checked[key]} />
                  <span className="text-[15px] font-medium tracking-tight text-gray-900">
                    <span className="text-coral-500">(필수)</span> {label}
                  </span>
                </button>
                {externalUrl && (
                  <a
                    href={externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[13px] font-medium text-gray-500 underline underline-offset-2"
                  >
                    전체보기
                  </a>
                )}
              </li>
            ))}
          </ul>

          {errorMessage && (
            <p
              role="alert"
              className="mt-3 text-[13px] font-medium leading-relaxed tracking-tight text-coral-600"
            >
              {errorMessage}
            </p>
          )}
        </div>

        <div className="absolute bottom-0 left-0 right-0 z-10 border-t border-gray-100 bg-white px-5 pb-[max(env(safe-area-inset-bottom),20px)] pt-3">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!allChecked || acceptOnboarding.isPending}
            className="w-full rounded-[14px] bg-mint-500 py-4 text-[16px] font-bold tracking-tight text-white transition-transform active:scale-[0.99] disabled:bg-gray-200 disabled:text-gray-400"
          >
            {acceptOnboarding.isPending ? "처리 중..." : "동의하고 시작"}
          </button>
        </div>
      </main>
    </PageShell>
  );
}

function CheckMark({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${
        checked ? "border-mint-500 bg-mint-500" : "border-gray-300"
      }`}
    >
      {checked && (
        <svg
          viewBox="0 0 24 24"
          className="h-3.5 w-3.5"
          fill="none"
          stroke="white"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </span>
  );
}
