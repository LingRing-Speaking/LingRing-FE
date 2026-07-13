type Props = {
  open: boolean;
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

// 친구 삭제 확인 모달. 삭제는 상호 관계 해제라 복구하려면 다시 요청해야 함을 안내한다.
export function FriendDeleteConfirmModal({ open, pending, onConfirm, onCancel }: Props) {
  if (!open) return null;

  return (
    <>
      <div aria-hidden="true" onClick={onCancel} className="absolute inset-0 z-30 bg-black/45" />
      <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center px-6">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="friend-delete-title"
          className="pointer-events-auto w-full max-w-[300px] rounded-[22px] bg-white p-6 shadow-[0_20px_50px_rgba(0,0,0,0.25)]"
        >
          <h2
            id="friend-delete-title"
            className="mb-2 text-center text-[17px] font-bold text-gray-900"
          >
            친구를 삭제할까요?
          </h2>
          <p className="mb-5 text-center text-[13px] leading-relaxed text-gray-500">
            삭제하면 목록에서 사라지고,
            <br />
            다시 친구가 되려면 새로 요청해야 해요.
          </p>
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 rounded-xl bg-gray-100 py-3 text-[14px] font-bold text-gray-600 active:bg-gray-200"
            >
              취소
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={pending}
              className="flex-1 rounded-xl bg-coral-500 py-3 text-[14px] font-bold text-white active:bg-coral-600 disabled:opacity-60"
            >
              삭제
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
