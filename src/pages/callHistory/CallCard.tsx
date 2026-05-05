import { useNavigate } from "react-router-dom";
import type { CallHistoryItem } from "@/domains/callHistory/types";
import { formatCallMeta } from "./timeBucket";

type Props = {
  call: CallHistoryItem;
  now: Date;
  onPartnerClick: (partnerId: number) => void;
};

export function CallCard({ call, now, onPartnerClick }: Props) {
  const navigate = useNavigate();
  const initial = call.partner.name[0] ?? "?";
  const meta = formatCallMeta(new Date(call.startedAt), call.durationSec, now);

  const handleBodyClick = () => {
    onPartnerClick(call.partner.id);
  };

  const handleActionClick = () => {
    navigate(`/calls/${call.id}/analysis`);
  };

  return (
    <div className="flex items-center gap-1 rounded-[18px] bg-white py-2 pl-3 pr-2 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
      <button
        type="button"
        onClick={handleBodyClick}
        className="flex flex-1 items-center gap-3 rounded-xl bg-transparent px-1 py-1.5 text-left active:bg-gray-50"
      >
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-mint-400 via-mint-500 to-coral-500">
          {call.partner.profileImage ? (
            <img
              src={call.partner.profileImage}
              alt="상대 프로필 이미지"
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-[20px] font-bold leading-none tracking-tight text-white">
              {initial}
            </span>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-[15.5px] font-bold leading-snug tracking-tight text-gray-900">
            {call.partner.name}
          </span>
          <span className="text-[12.5px] font-medium leading-none tracking-tight text-gray-500 tabular-nums">
            {meta}
          </span>
        </div>
      </button>
      <button
        type="button"
        onClick={handleActionClick}
        className={
          call.analyzed
            ? "flex flex-shrink-0 items-center gap-1 rounded-[10px] bg-transparent px-2 py-2 text-[13px] font-semibold leading-none tracking-tight text-gray-500 active:text-gray-800"
            : "flex flex-shrink-0 items-center gap-1 rounded-[10px] bg-mint-500 px-3 py-2 text-[13px] font-bold leading-none tracking-tight text-white active:bg-mint-600"
        }
      >
        {call.analyzed ? "분석 보기" : "분석하기"}
      </button>
    </div>
  );
}
