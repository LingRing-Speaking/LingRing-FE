import { Avatar } from "@/components/Avatar";
import { useRequestAnalysis } from "@/domains/callHistory/hooks/useRequestAnalysis";
import { usePollAnalysisStatus } from "@/domains/callHistory/hooks/usePollAnalysisStatus";
import type { CallHistoryItem } from "@/domains/callHistory/types";
import { AnalysisButton } from "./AnalysisButton";
import { formatCallMeta } from "./timeBucket";

const UNKNOWN_PARTNER_NAME = "알 수 없음";

type Props = {
  call: CallHistoryItem;
  now: Date;
  onPartnerClick: (partnerId: number) => void;
};

export function CallCard({ call, now, onPartnerClick }: Props) {
  const meta = formatCallMeta(new Date(call.startedAt), call.durationSec, now);
  const { partner, analysisStatus } = call;
  const isUnknown = partner === null;

  const { mutate: triggerAnalysis } = useRequestAnalysis();
  usePollAnalysisStatus(call.id, analysisStatus === "IN_PROGRESS");

  const handleBodyClick = () => {
    if (!partner) return;
    onPartnerClick(partner.id);
  };

  return (
    <div className="flex items-center gap-2 rounded-[18px] bg-white py-2 pl-3 pr-2 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
      <button
        type="button"
        onClick={handleBodyClick}
        disabled={isUnknown}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-xl bg-transparent px-1 py-1.5 text-left active:bg-gray-50 disabled:cursor-default disabled:active:bg-transparent"
      >
        {partner ? (
          <Avatar
            src={partner.profileImage}
            name={partner.name}
            size="sm"
            alt="상대 프로필 이미지"
            className="flex-shrink-0"
          />
        ) : (
          <div
            aria-hidden="true"
            className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-[20px] font-bold leading-none text-gray-400"
          >
            ?
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span
            className={`text-[15.5px] font-bold leading-snug tracking-tight ${
              isUnknown ? "text-gray-400" : "text-gray-900"
            }`}
          >
            {partner?.name ?? UNKNOWN_PARTNER_NAME}
          </span>
          <span className="text-[12.5px] font-medium leading-none tracking-tight text-gray-500 tabular-nums">
            {meta}
          </span>
        </div>
      </button>
      <AnalysisButton
        status={analysisStatus}
        onTriggerAnalysis={() => triggerAnalysis(call.id)}
      />
    </div>
  );
}
