import { Avatar } from "@/components/Avatar";
import type { CallHistoryItem } from "@/domains/callHistory/types";
import { formatCallMeta } from "./timeBucket";

type Props = {
  call: CallHistoryItem;
  now: Date;
  onPartnerClick: (partnerId: number) => void;
};

export function CallCard({ call, now, onPartnerClick }: Props) {
  const meta = formatCallMeta(new Date(call.startedAt), call.durationSec, now);

  const handleBodyClick = () => {
    onPartnerClick(call.partner.id);
  };

  return (
    <div className="flex items-center gap-1 rounded-[18px] bg-white py-2 pl-3 pr-2 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
      <button
        type="button"
        onClick={handleBodyClick}
        className="flex flex-1 items-center gap-3 rounded-xl bg-transparent px-1 py-1.5 text-left active:bg-gray-50"
      >
        <Avatar
          src={call.partner.profileImage}
          name={call.partner.name}
          size="sm"
          alt="상대 프로필 이미지"
          className="flex-shrink-0"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-[15.5px] font-bold leading-snug tracking-tight text-gray-900">
            {call.partner.name}
          </span>
          <span className="text-[12.5px] font-medium leading-none tracking-tight text-gray-500 tabular-nums">
            {meta}
          </span>
        </div>
      </button>
      {/* AI 분석 기능은 미출시 — 준비 중 라벨로 disabled. 출시 시 navigate 흐름 복원 */}
      <button
        type="button"
        disabled
        aria-label="AI 분석 준비 중"
        className="flex flex-shrink-0 items-center gap-1 rounded-[10px] bg-gray-100 px-2.5 py-2 text-[12px] font-semibold leading-none tracking-tight text-gray-400"
      >
        분석 준비 중
      </button>
    </div>
  );
}
