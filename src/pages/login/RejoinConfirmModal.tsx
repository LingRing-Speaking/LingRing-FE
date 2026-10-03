import { useEffect } from "react";

interface RejoinConfirmModalProps {
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/** 1년 내 탈퇴 이력이 있는 소셜 계정의 재가입 확인 (LingRing-BE #205). */
export function RejoinConfirmModal({ loading, onCancel, onConfirm }: RejoinConfirmModalProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !loading) onCancel();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [loading, onCancel]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="rejoin-modal-title"
      className="absolute inset-0 z-20 flex items-center justify-center px-6"
    >
      <button
        type="button"
        aria-label="재가입 확인 닫기"
        onClick={loading ? undefined : onCancel}
        disabled={loading}
        className="absolute inset-0 bg-black/40"
      />
      <div className="relative w-full max-w-[320px] rounded-[20px] bg-white p-6 shadow-ctrl">
        <h3
          id="rejoin-modal-title"
          className="text-center text-[17px] font-bold leading-tight tracking-tight text-gray-900"
        >
          최근에 탈퇴한 계정이에요
        </h3>
        <p className="mt-2 text-center text-[13px] font-medium leading-relaxed tracking-tight text-gray-600">
          다시 가입하면 새 계정으로 시작해요.
          <br />
          이전 기록은 복구되지 않고,
          <br />
          추천인 혜택도 받을 수 없어요.
        </p>
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 rounded-[14px] bg-gray-100 py-3.5 text-[15px] font-bold tracking-tight text-gray-800 transition-transform active:scale-[0.98] disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 rounded-[14px] bg-mint-500 py-3.5 text-[15px] font-bold tracking-tight text-white transition-transform active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? "가입 중..." : "다시 가입하기"}
          </button>
        </div>
      </div>
    </div>
  );
}
