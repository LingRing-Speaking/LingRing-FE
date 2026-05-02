import { useEffect, useState } from "react";
import { useSubmitReport } from "@/domains/report/hooks/useSubmitReport";
import type { ReportReason } from "@/domains/report/types";

const DETAIL_MAX_LEN = 200;
const DETAIL_MIN_LEN = 5;

const REASONS: ReadonlyArray<{ value: ReportReason; label: string }> = [
  { value: "INAPPROPRIATE_CONVERSATION", label: "부적절한 대화" },
  { value: "BAD_MANNERS", label: "비매너 태도" },
  { value: "OTHER", label: "기타" },
];

type Props = {
  partnerId: number | null;
  open: boolean;
  onClose: () => void;
  onCancel: () => void;
};

export function ReportModal({ partnerId, open, onClose, onCancel }: Props) {
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
      <div
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 z-30 bg-black/45"
      />
      <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center px-6">
        <ReportModalCard
          partnerId={partnerId}
          onClose={onClose}
          onCancel={onCancel}
        />
      </div>
    </>
  );
}

function ReportModalCard({
  partnerId,
  onClose,
  onCancel,
}: {
  partnerId: number;
  onClose: () => void;
  onCancel: () => void;
}) {
  const submission = useSubmitReport();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [detail, setDetail] = useState("");

  const isComplete = submission.isSuccess;
  const detailValid = detail.trim().length >= DETAIL_MIN_LEN;
  const canSubmit = reason != null && detailValid && !submission.isPending;

  const handleSubmit = () => {
    if (!canSubmit || reason == null) return;
    submission.mutate({
      reportedUserId: partnerId,
      reason,
      description: detail.trim(),
    });
  };

  if (isComplete) {
    return <CompleteCard onClose={onClose} />;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-title"
      className="pointer-events-auto relative w-full max-w-[320px] rounded-[22px] bg-white p-6 pb-[22px] shadow-[0_20px_50px_rgba(0,0,0,0.25)]"
    >
      <CloseButton onClick={onClose} />

      <h2
        id="report-title"
        className="m-0 mb-1.5 text-center text-[17px] font-bold leading-[1.3] tracking-tight text-gray-900"
      >
        신고 사유를 선택해주세요
      </h2>
      <p className="m-0 mb-[18px] text-center text-[13px] font-medium leading-[1.5] tracking-tight text-gray-500">
        신고하면 해당 사용자는 자동으로 차단됩니다
      </p>

      <div className="mb-[18px] flex flex-col gap-2">
        {REASONS.map((item) => (
          <ReasonItem
            key={item.value}
            label={item.label}
            selected={reason === item.value}
            onClick={() => setReason(item.value)}
          />
        ))}
      </div>

      <DetailField value={detail} onChange={setDetail} />

      {submission.isError && (
        <p className="m-0 mb-2 text-center text-[12.5px] font-medium text-coral-600">
          신고 접수에 실패했어요. 잠시 후 다시 시도해주세요.
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="flex-1 rounded-[12px] bg-coral-500 px-0 py-3.5 text-[14.5px] font-bold tracking-tight text-white transition-colors active:bg-coral-600 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
        >
          {submission.isPending ? "전송 중..." : "신고하고 차단"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-[12px] bg-gray-100 px-0 py-3.5 text-[14.5px] font-bold tracking-tight text-gray-700 active:bg-gray-200"
        >
          취소
        </button>
      </div>
    </div>
  );
}

function ReasonItem({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  const containerClass = selected
    ? "bg-coral-100 border-coral-500"
    : "bg-gray-50 border-transparent";
  const radioClass = selected
    ? "border-coral-500 after:scale-100"
    : "border-gray-300 after:scale-0";

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={`flex items-center gap-2.5 rounded-[12px] border-[1.5px] px-3.5 py-3.5 text-left transition-colors active:bg-gray-100 ${containerClass}`}
    >
      <span
        className={`relative flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors after:h-2.5 after:w-2.5 after:rounded-full after:bg-coral-500 after:transition-transform after:content-[''] ${radioClass}`}
      />
      <span className="text-[14.5px] font-semibold leading-none tracking-tight text-gray-800">
        {label}
      </span>
    </button>
  );
}

function DetailField({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="mb-[18px]">
      <div className="mb-2 flex items-center justify-between text-[12.5px] font-semibold tracking-tight text-gray-600">
        <label htmlFor="report-detail">상세 내용</label>
        <span className="text-[12px] font-medium tabular-nums text-gray-400">
          {value.length} / {DETAIL_MAX_LEN}
        </span>
      </div>
      <textarea
        id="report-detail"
        maxLength={DETAIL_MAX_LEN}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="어떤 일이 있었는지 구체적으로 적어주세요"
        className="block max-h-[140px] min-h-[88px] w-full resize-none rounded-[12px] border-[1.5px] border-gray-200 bg-white px-3.5 py-3 text-[14px] font-medium leading-[1.5] tracking-tight text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-coral-500"
      />
    </div>
  );
}

function CompleteCard({ onClose }: { onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="complete-title"
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
        id="complete-title"
        className="m-0 mb-2 text-[17px] font-bold leading-[1.3] tracking-tight text-gray-900"
      >
        신고가 접수되었어요
      </h2>
      <p className="m-0 mb-5 text-[13.5px] font-medium leading-[1.5] tracking-tight text-gray-500">
        검토 후 조치하겠습니다.
        <br />
        해당 사용자는 자동으로 차단되었어요.
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
