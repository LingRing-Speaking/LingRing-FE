import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { REFERRAL_STATUS_QUERY_KEY, useReferralStatus } from "../hooks/useReferralStatus";
import { REFERRAL_REDEEM_TITLE_ID, ReferralRedeemCard } from "./ReferralRedeemCard";

/**
 * 온보딩에서 추천인 입력을 놓친 유저용 설정 진입점. 입력 가능한 동안(가입 후 7일)만 노출된다.
 */
export function ReferralSetting() {
  const queryClient = useQueryClient();
  const status = useReferralStatus();
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 입력 성공·실패(이미 입력, 기간 만료 등) 후 행 노출 여부를 서버 기준으로 다시 맞춘다.
  // 모달이 열린 동안 갱신하면 안내를 보기 전에 행과 함께 사라지므로 닫을 때 갱신한다.
  const closeModal = () => {
    setIsModalOpen(false);
    void queryClient.invalidateQueries({ queryKey: REFERRAL_STATUS_QUERY_KEY });
  };

  if (!status.data?.redeemable) return null;

  return (
    <>
      <h2 className="mx-1 mb-2.5 mt-7 text-[13px] font-bold tracking-tight text-gray-600">혜택</h2>
      <div className="overflow-hidden rounded-[18px] bg-white shadow-card">
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="flex min-h-[52px] w-full items-center justify-between gap-3 px-[18px] py-[15px] text-left transition-colors active:bg-gray-50"
        >
          <span className="flex-1 text-[15px] font-medium tracking-tight text-gray-900">
            추천인 입력
          </span>
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-4 w-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={REFERRAL_REDEEM_TITLE_ID}
          className="absolute inset-0 z-20 flex items-center justify-center px-6"
        >
          <div aria-hidden="true" className="absolute inset-0 bg-black/40" />
          <ReferralRedeemCard closeLabel="닫기" onClose={closeModal} />
        </div>
      )}
    </>
  );
}
