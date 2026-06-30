import type { AnalysisStatus } from "@/domains/callHistory/types";

type Props = {
  analysisStatus: AnalysisStatus;
  onTriggerAnalysis: () => void;
  onViewResult: () => void;
};

export function AnalysisButton({
  analysisStatus,
  onTriggerAnalysis,
  onViewResult,
}: Props) {
  switch (analysisStatus) {
    case "WAITING_RECORDINGS":
      // 녹음이 아직 업로드 중이라 분석을 시작할 수 없다. 클릭이 막힌 비활성 상태.
      return (
        <button
          type="button"
          disabled
          aria-label="대기중"
          className="inline-flex flex-shrink-0 cursor-default items-center gap-1.5 rounded-full bg-gray-100 px-3.5 py-2 text-[13px] font-bold leading-none tracking-tight text-gray-400"
        >
          대기중
        </button>
      );

    case "READY":
      return (
        <button
          type="button"
          onClick={onTriggerAnalysis}
          aria-label="분석하기"
          className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full bg-mint-500 px-3.5 py-2 text-[13px] font-bold leading-none tracking-tight text-white transition-colors active:bg-mint-600"
        >
          분석하기
        </button>
      );

    case "PROCESSING":
      return (
        <button
          type="button"
          disabled
          aria-label="분석중"
          className="inline-flex flex-shrink-0 cursor-default items-center gap-1.5 rounded-full bg-gray-100 px-3.5 py-2 text-[13px] font-bold leading-none tracking-tight text-gray-500"
        >
          <span
            role="status"
            aria-label="분석 진행 중"
            className="h-3 w-3 animate-spin rounded-full border-2 border-gray-300 border-t-gray-500"
          />
          분석중
        </button>
      );

    case "COMPLETED":
      return (
        <button
          type="button"
          onClick={onViewResult}
          aria-label="분석보기"
          className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full bg-mint-100 px-3.5 py-2 text-[13px] font-bold leading-none tracking-tight text-mint-600 transition-colors active:bg-mint-200"
        >
          분석보기
        </button>
      );

    case "FAILED":
      return (
        <button
          type="button"
          onClick={onTriggerAnalysis}
          aria-label="재분석"
          className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full bg-coral-500 px-3.5 py-2 text-[13px] font-bold leading-none tracking-tight text-white transition-colors active:bg-coral-600"
        >
          재분석
        </button>
      );

    case "EXPIRED":
      // 녹음 보관 기간(30일)이 지나 녹음이 삭제됨 → 분석을 시작/재시도할 수 없다. 비활성.
      return (
        <button
          type="button"
          disabled
          aria-label="기간 만료"
          className="inline-flex flex-shrink-0 cursor-default items-center gap-1.5 rounded-full bg-gray-100 px-3.5 py-2 text-[13px] font-bold leading-none tracking-tight text-gray-400"
        >
          기간 만료
        </button>
      );
  }
}
