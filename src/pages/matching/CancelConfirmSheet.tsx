type Props = {
  open: boolean;
  onKeep: () => void;
  onCancel: () => void;
};

export function CancelConfirmSheet({ open, onKeep, onCancel }: Props) {
  return (
    <>
      <button
        type="button"
        aria-label="시트 닫기"
        aria-hidden={!open}
        onClick={onKeep}
        tabIndex={open ? 0 : -1}
        className={`absolute inset-0 z-10 cursor-default bg-black/35 transition-opacity duration-200 ${
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-sheet-title"
        aria-hidden={!open}
        className={`absolute inset-x-0 bottom-0 z-[11] rounded-t-3xl bg-white px-5 pb-7 pt-6 shadow-[0_-10px_40px_rgba(0,0,0,0.15)] transition-transform duration-300 ease-out ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <h3
          id="cancel-sheet-title"
          className="m-0 mb-1 text-center text-[17px] font-bold leading-snug text-gray-900"
        >
          매칭을 취소할까요?
        </h3>
        <p className="m-0 mb-4 text-center text-[13px] font-medium leading-relaxed text-gray-600">
          조금만 더 기다리면 만날 수 있어요
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onKeep}
            className="flex-1 rounded-2xl bg-gray-100 py-3.5 text-[15px] font-bold leading-none tracking-[-0.01em] text-gray-800 active:scale-[0.98]"
          >
            계속 기다리기
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-2xl bg-gray-900 py-3.5 text-[15px] font-bold leading-none tracking-[-0.01em] text-white active:scale-[0.98]"
          >
            취소하기
          </button>
        </div>
      </div>
    </>
  );
}
