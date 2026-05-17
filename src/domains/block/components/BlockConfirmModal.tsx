import { useEffect } from "react";
import { useBlockUser } from "../hooks/useBlockUser";

type Props = {
  partnerId: number | null;
  open: boolean;
  onClose: () => void;
  onCancel: () => void;
};

export function BlockConfirmModal({ partnerId, open, onClose, onCancel }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || partnerId == null) return null;

  return (
    <>
      <div aria-hidden="true" onClick={onClose} className="absolute inset-0 z-30 bg-black/45" />
      <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center px-6">
        <BlockModalCard partnerId={partnerId} onClose={onClose} onCancel={onCancel} />
      </div>
    </>
  );
}

function BlockModalCard({
  partnerId,
  onClose,
  onCancel,
}: {
  partnerId: number;
  onClose: () => void;
  onCancel: () => void;
}) {
  const submission = useBlockUser();

  const handleSubmit = () => {
    if (submission.isPending) return;
    submission.mutate({ blockedUserId: partnerId });
  };

  if (submission.isSuccess) {
    return <CompleteCard onClose={onClose} />;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="block-title"
      className="pointer-events-auto relative w-full max-w-[320px] rounded-[22px] bg-white p-6 pb-[22px] shadow-[0_20px_50px_rgba(0,0,0,0.25)]"
    >
      <CloseButton onClick={onCancel} />

      <h2
        id="block-title"
        className="m-0 mb-2.5 mt-1 text-center text-[17px] font-bold leading-[1.3] tracking-tight text-gray-900"
      >
        이 사용자를 차단할까요?
      </h2>
      <p className="m-0 mb-[22px] text-center text-[13.5px] font-medium leading-[1.5] tracking-tight text-gray-500">
        차단하면 서로 매칭에서 만나지 않아요.
        <br />
        설정 &gt; 차단 관리에서 언제든 해제할 수 있어요.
      </p>

      {submission.isError && (
        <p className="m-0 mb-2 text-center text-[12.5px] font-medium text-coral-600">
          차단에 실패했어요. 잠시 후 다시 시도해주세요.
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
          {submission.isPending ? "처리 중..." : "차단"}
        </button>
      </div>
    </div>
  );
}

function CompleteCard({ onClose }: { onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="block-complete-title"
      className="pointer-events-auto relative w-full max-w-[300px] rounded-[22px] bg-white px-6 pb-6 pt-8 text-center shadow-[0_20px_50px_rgba(0,0,0,0.25)]"
    >
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-mint-100">
        <svg
          viewBox="0 0 24 24"
          className="h-8 w-8"
          fill="none"
          stroke="#1FBF92"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="5 12.5 10 17.5 19 7.5" />
        </svg>
      </div>
      <h2
        id="block-complete-title"
        className="m-0 mb-2 text-[17px] font-bold leading-[1.3] tracking-tight text-gray-900"
      >
        차단했어요
      </h2>
      <p className="m-0 mb-5 text-[13.5px] font-medium leading-[1.5] tracking-tight text-gray-500">
        설정 &gt; 차단 관리에서
        <br />
        언제든 해제할 수 있어요.
      </p>
      <button
        type="button"
        onClick={onClose}
        className="w-full rounded-[12px] bg-mint-500 py-3.5 text-[14.5px] font-bold tracking-tight text-white active:bg-mint-600"
      >
        확인
      </button>
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
