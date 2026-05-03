import { useEffect } from "react";

interface WithdrawConfirmModalProps {
  open: boolean;
  loading: boolean;
  errorMessage: string | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function WithdrawConfirmModal({
  open,
  loading,
  errorMessage,
  onClose,
  onConfirm,
}: WithdrawConfirmModalProps) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !loading) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, loading, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="withdraw-modal-title"
      className="absolute inset-0 z-20 flex items-center justify-center px-6"
    >
      <button
        type="button"
        aria-label="회원탈퇴 확인 닫기"
        onClick={loading ? undefined : onClose}
        disabled={loading}
        className="absolute inset-0 bg-black/40"
      />
      <div className="relative w-full max-w-[320px] rounded-[20px] bg-white p-6 shadow-ctrl">
        <h3
          id="withdraw-modal-title"
          className="text-center text-[17px] font-bold leading-tight tracking-tight text-gray-900"
        >
          정말 탈퇴할까요?
        </h3>
        <p className="mt-2 text-center text-[13px] font-medium leading-relaxed tracking-tight text-gray-600">
          탈퇴하면 모든 데이터가 즉시 삭제되고
          <br />
          복구할 수 없어요.
        </p>
        {errorMessage && (
          <p
            role="alert"
            className="mt-3 rounded-[10px] bg-coral-100 px-3 py-2 text-center text-[12.5px] font-medium tracking-tight text-coral-600"
          >
            {errorMessage}
          </p>
        )}
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 rounded-[14px] bg-gray-100 py-3.5 text-[15px] font-bold tracking-tight text-gray-800 transition-transform active:scale-[0.98] disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 rounded-[14px] bg-coral-500 py-3.5 text-[15px] font-bold tracking-tight text-white transition-transform active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? "탈퇴 중..." : "탈퇴하기"}
          </button>
        </div>
      </div>
    </div>
  );
}
