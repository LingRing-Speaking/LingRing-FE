import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageShell } from "@/components/PageShell";
import { withdraw, type WithdrawalReason } from "@/domains/auth/api/withdraw";
import { clearLocalSession } from "@/domains/auth/clearLocalSession";
import { ApiError } from "@/lib/http";
import { WithdrawConfirmModal } from "./WithdrawConfirmModal";

const REASON_OPTIONS: { value: WithdrawalReason; label: string }[] = [
  { value: "NO_GOOD_MATCH", label: "매칭이 잘 안 돼요" },
  { value: "NO_PROGRESS", label: "영어 실력이 늘지 않아요" },
  { value: "BUGGY", label: "앱이 자주 멈춰요 / 오류가 많아요" },
  { value: "RARELY_USE", label: "잘 사용하지 않아요" },
  { value: "MISSING_FEATURE", label: "원하는 기능이 없어요" },
  { value: "OTHER", label: "기타" },
];

const MAX_DESCRIPTION_LENGTH = 200;
const GENERIC_ERROR_MESSAGE = "잠시 후 다시 시도해주세요.";

export function WithdrawPage() {
  const navigate = useNavigate();
  const [selectedReason, setSelectedReason] = useState<WithdrawalReason | null>(null);
  const [otherDescription, setOtherDescription] = useState("");
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const trimmedDescription = otherDescription.trim();
  const canSubmit = (() => {
    if (!selectedReason) return false;
    if (selectedReason === "OTHER") return trimmedDescription.length > 0;
    return true;
  })();

  const openConfirm = () => {
    if (!canSubmit) return;
    setErrorMessage(null);
    setIsConfirmModalOpen(true);
  };

  const closeConfirm = () => {
    if (isWithdrawing) return;
    setIsConfirmModalOpen(false);
    setErrorMessage(null);
  };

  const handleConfirm = async () => {
    if (!selectedReason || !canSubmit) return;
    setIsWithdrawing(true);
    setErrorMessage(null);
    try {
      await withdraw(
        selectedReason === "OTHER"
          ? { reason: "OTHER", description: trimmedDescription }
          : { reason: selectedReason },
      );
      await clearLocalSession();
      navigate("/login", { replace: true });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : GENERIC_ERROR_MESSAGE;
      setErrorMessage(message || GENERIC_ERROR_MESSAGE);
      setIsWithdrawing(false);
    }
  };

  return (
    <PageShell>
      <main className="relative flex flex-1 flex-col bg-gray-50">
        <div className="relative flex h-[52px] shrink-0 items-center bg-white px-2">
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
            회원탈퇴
          </h1>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-[112px] pt-4">
          <div
            role="note"
            className="rounded-[14px] bg-coral-100 px-4 py-3.5 text-[13.5px] font-medium leading-relaxed tracking-tight text-coral-600"
          >
            탈퇴하면 통화 기록·표현·통계가 모두 즉시 삭제되고,
            <br />
            다시 복구할 수 없어요.
          </div>

          <h2 className="mb-3 mt-7 text-[15px] font-bold tracking-tight text-gray-900">
            왜 떠나시나요?
          </h2>
          <div
            role="radiogroup"
            aria-label="탈퇴 사유"
            className="overflow-hidden rounded-[18px] bg-white shadow-card"
          >
            {REASON_OPTIONS.map((option, index) => {
              const checked = selectedReason === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  onClick={() => setSelectedReason(option.value)}
                  className={`flex min-h-[52px] w-full items-center justify-between gap-3 px-[18px] py-[14px] text-left transition-colors active:bg-gray-50 ${
                    index > 0 ? "border-t border-gray-100" : ""
                  }`}
                >
                  <span className="flex-1 text-[15px] font-medium tracking-tight text-gray-900">
                    {option.label}
                  </span>
                  <span
                    aria-hidden="true"
                    className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                      checked ? "border-mint-500 bg-mint-500" : "border-gray-300"
                    }`}
                  >
                    {checked && (
                      <svg
                        viewBox="0 0 24 24"
                        className="h-3 w-3"
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
                </button>
              );
            })}
          </div>

          {selectedReason === "OTHER" && (
            <div className="mt-3">
              <label htmlFor="withdraw-other-reason" className="sr-only">
                기타 사유 입력
              </label>
              <textarea
                id="withdraw-other-reason"
                value={otherDescription}
                onChange={(event) => setOtherDescription(event.target.value)}
                maxLength={MAX_DESCRIPTION_LENGTH}
                rows={4}
                placeholder="어떤 점이 아쉬웠는지 알려주세요"
                className="w-full resize-none rounded-[14px] border border-gray-200 bg-white px-4 py-3.5 text-[14px] font-medium leading-relaxed tracking-tight text-gray-900 placeholder:text-gray-400 focus:border-mint-500 focus:outline-none"
              />
              <p className="mt-1.5 text-right text-[12px] font-medium tabular-nums text-gray-500">
                {otherDescription.length}/{MAX_DESCRIPTION_LENGTH}
              </p>
            </div>
          )}
        </div>

        <div className="absolute bottom-0 left-0 right-0 z-10 border-t border-gray-100 bg-white px-5 pb-[max(env(safe-area-inset-bottom),20px)] pt-3">
          <button
            type="button"
            onClick={openConfirm}
            disabled={!canSubmit}
            className="w-full rounded-[14px] bg-coral-500 py-4 text-[16px] font-bold tracking-tight text-white transition-transform active:scale-[0.99] disabled:bg-gray-200 disabled:text-gray-400"
          >
            탈퇴하기
          </button>
        </div>
      </main>

      <WithdrawConfirmModal
        open={isConfirmModalOpen}
        loading={isWithdrawing}
        errorMessage={errorMessage}
        onClose={closeConfirm}
        onConfirm={handleConfirm}
      />
    </PageShell>
  );
}
