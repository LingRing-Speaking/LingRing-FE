import { useEffect } from "react";

interface LogoutConfirmModalProps {
  open: boolean;
  loading: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function LogoutConfirmModal({
  open,
  loading,
  onClose,
  onConfirm,
}: LogoutConfirmModalProps) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="logout-modal-title"
      className="absolute inset-0 z-20 flex items-center justify-center px-6"
    >
      <button
        type="button"
        aria-label="로그아웃 확인 닫기"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />
      <div className="relative w-full max-w-[300px] rounded-[20px] bg-white p-6 shadow-ctrl">
        <h3
          id="logout-modal-title"
          className="text-center text-[17px] font-bold leading-tight tracking-tight text-gray-900"
        >
          정말 로그아웃 할까요?
        </h3>
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 rounded-[14px] bg-gray-100 py-3.5 text-[15px] font-bold tracking-tight text-gray-800 transition-transform active:scale-[0.98] disabled:opacity-50"
          >
            닫기
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 rounded-[14px] bg-coral-500 py-3.5 text-[15px] font-bold tracking-tight text-white transition-transform active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? "로그아웃 중..." : "로그아웃"}
          </button>
        </div>
      </div>
    </div>
  );
}
