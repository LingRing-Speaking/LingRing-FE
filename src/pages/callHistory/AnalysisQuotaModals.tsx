import { useEffect, type ReactNode } from "react";
import { TicketIcon } from "./AnalysisQuotaBadge";

/**
 * 분석 티켓 흐름의 두 모달이 공유하는 껍데기. 오버레이·중앙 정렬·ESC/오버레이
 * 클릭 닫기를 한곳에 모은다. (이 페이지 한정 헬퍼라 공용 컴포넌트로 올리지 않음.)
 */
function ModalShell({
  open,
  onClose,
  labelledById,
  children,
}: {
  open: boolean;
  onClose: () => void;
  labelledById: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 z-30 bg-black/45"
      />
      <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center px-6">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={labelledById}
          className="pointer-events-auto relative w-full max-w-[320px] rounded-[22px] bg-white p-6 pb-[22px] shadow-[0_20px_50px_rgba(0,0,0,0.25)]"
        >
          {children}
        </div>
      </div>
    </>
  );
}

/**
 * 분석 차감 확인 모달. "분석하기" 를 누르면 티켓 1장이 차감되므로 실수 차감을
 * 막기 위해 한 번 더 확인받는다. (잔여 수치는 상단 배지로만 노출 — 모달엔 표시 X)
 */
export function AnalysisConfirmModal({
  open,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <ModalShell
      open={open}
      onClose={onCancel}
      labelledById="analysis-confirm-title"
    >
      <h2
        id="analysis-confirm-title"
        className="m-0 mb-2.5 mt-1 text-center text-[17px] font-bold leading-[1.3] tracking-tight text-gray-900"
      >
        이 통화를 분석할까요?
      </h2>
      <p className="m-0 mb-[22px] text-center text-[13.5px] font-medium leading-[1.5] tracking-tight text-gray-500">
        티켓 1장이 사용돼요
      </p>

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
          onClick={onConfirm}
          className="flex-1 rounded-[12px] bg-mint-500 px-0 py-3.5 text-[14.5px] font-bold tracking-tight text-white transition-colors active:bg-mint-600"
        >
          분석하기
        </button>
      </div>
    </ModalShell>
  );
}

/**
 * 분석 티켓 소진 모달. 일반·황금티켓이 모두 0 일 때(클릭 시점 또는 서버 403)
 * 노출한다. 충전(구매) 동선은 아직 미도입이라 안내만 한다.
 */
export function AnalysisExhaustedModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <ModalShell
      open={open}
      onClose={onClose}
      labelledById="analysis-exhausted-title"
    >
      <div className="mx-auto mb-4 mt-1 flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-700">
        <TicketIcon className="h-7 w-7" />
      </div>
      <h2
        id="analysis-exhausted-title"
        className="m-0 mb-2 text-center text-[17px] font-bold leading-[1.3] tracking-tight text-gray-900"
      >
        오늘 분석 티켓을 다 썼어요
      </h2>
      <p className="m-0 mb-5 text-center text-[13.5px] font-medium leading-[1.5] tracking-tight text-gray-500">
        매일 0시에 일반티켓 1장이
        <br />
        다시 충전돼요.
      </p>
      <button
        type="button"
        onClick={onClose}
        className="w-full rounded-[12px] bg-mint-500 py-3.5 text-[14.5px] font-bold tracking-tight text-white active:bg-mint-600"
      >
        확인
      </button>
    </ModalShell>
  );
}
