import type { AnalysisQuota } from "@/domains/callHistory/types";
import { AnalysisQuotaBadge } from "./AnalysisQuotaBadge";

type Props = {
  quota: AnalysisQuota | undefined;
};

/** 통화 기록 제목 + 분석 티켓 잔여 배지. 기록이 비어 있어도 티켓은 보여야 해서 목록과 빈 화면이 함께 쓴다. */
export function CallHistoryHeader({ quota }: Props) {
  return (
    <div className="mb-3.5 mt-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
      <h1 className="m-0 text-[22px] font-extrabold leading-[1.3] tracking-[-0.02em] text-gray-900">
        통화 기록
      </h1>
      <AnalysisQuotaBadge quota={quota} />
    </div>
  );
}
