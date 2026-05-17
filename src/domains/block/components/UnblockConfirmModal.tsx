import { useEffect } from "react";
import { useUnblockUser } from "../hooks/useUnblockUser";

type UnblockTarget = { id: number; nickname: string };

type Props = {
  target: UnblockTarget | null;
  open: boolean;
  onClose: () => void;
  onCancel: () => void;
};

export function UnblockConfirmModal({ target, open, onClose, onCancel }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open || target == null) return null;

  return (
    <>
      <div aria-hidden="true" onClick={onCancel} className="absolute inset-0 z-30 bg-black/45" />
      <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center px-6">
        <UnblockModalCard target={target} onClose={onClose} onCancel={onCancel} />
      </div>
    </>
  );
}

function UnblockModalCard({
  target,
  onClose,
  onCancel,
}: {
  target: UnblockTarget;
  onClose: () => void;
  onCancel: () => void;
}) {
  const submission = useUnblockUser();

  const handleSubmit = () => {
    if (submission.isPending) return;
    submission.mutate(target.id, { onSuccess: onClose });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="unblock-title"
      className="pointer-events-auto relative w-full max-w-[320px] rounded-[22px] bg-white p-6 pb-[22px] shadow-[0_20px_50px_rgba(0,0,0,0.25)]"
    >
      <CloseButton onClick={onCancel} />

      <h2
        id="unblock-title"
        className="m-0 mb-2.5 mt-1 text-center text-[17px] font-bold leading-[1.3] tracking-tight text-gray-900"
      >
        {target.nickname}님의 차단을 해제할까요?
      </h2>
      <p className="m-0 mb-[22px] text-center text-[13.5px] font-medium leading-[1.5] tracking-tight text-gray-500">
        다시 매칭에서 만날 수 있어요.
      </p>

      {submission.isError && (
        <p className="m-0 mb-2 text-center text-[12.5px] font-medium text-coral-600">
          차단 해제에 실패했어요. 잠시 후 다시 시도해주세요.
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-[12px] bg-gray-100 px-0 py-3.5 text-[14.5px] font-bold tracking-tight text-gray-700 active:bg-gray-200"
        >
          취소
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submission.isPending}
          className="flex-1 rounded-[12px] bg-coral-500 px-0 py-3.5 text-[14.5px] font-bold tracking-tight text-white transition-colors active:bg-coral-600 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
        >
          {submission.isPending ? "처리 중..." : "해제"}
        </button>
      </div>
    </div>
  );
}

function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="닫기"
      onClick={onClick}
      className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-gray-500 active:bg-gray-100"
    >
      <svg
        viewBox="0 0 24 24"
        className="h-[18px] w-[18px]"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </button>
  );
}
