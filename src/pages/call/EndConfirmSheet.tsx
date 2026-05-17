type Props = {
  open: boolean;
  onKeep: () => void;
  onEnd: () => void;
};

export function EndConfirmSheet({ open, onKeep, onEnd }: Props) {
  return (
    <>
      <button
        type="button"
        aria-label="시트 닫기"
        aria-hidden={!open}
        onClick={onKeep}
        tabIndex={open ? 0 : -1}
        className={`absolute inset-0 z-10 cursor-default bg-black/40 transition-opacity duration-200 ${
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="end-sheet-title"
        aria-hidden={!open}
        className={`absolute inset-x-0 bottom-0 z-[11] rounded-t-3xl bg-white px-5 pb-7 pt-6 shadow-[0_-10px_40px_rgba(0,0,0,0.15)] transition-transform duration-300 ease-out ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <h3
          id="end-sheet-title"
          className="m-0 mb-5 text-center text-[17px] font-bold leading-snug text-gray-900"
        >
          통화를 종료할까요?
        </h3>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onKeep}
            className="flex-1 rounded-2xl bg-gray-100 py-3.5 text-[15px] font-bold leading-none tracking-[-0.01em] text-gray-800 active:scale-[0.98]"
          >
            계속하기
          </button>
          <button
            type="button"
            onClick={onEnd}
            className="flex-1 rounded-2xl bg-coral-500 py-3.5 text-[15px] font-bold leading-none tracking-[-0.01em] text-white active:scale-[0.98]"
          >
            종료하기
          </button>
        </div>
      </div>
    </>
  );
}
