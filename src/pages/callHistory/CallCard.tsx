import { useNavigate } from "react-router-dom";
import { Avatar } from "@/components/Avatar";
import { useRequestAnalysis } from "@/domains/callHistory/hooks/useRequestAnalysis";
import type { CallHistoryItem } from "@/domains/callHistory/types";
import { AnalysisButton } from "./AnalysisButton";
import { formatCallMeta } from "./timeBucket";

const UNKNOWN_PARTNER_NAME = "알 수 없음";

// 1분(60초) 이상 통화만 분석을 요청할 수 있다. (서버에서도 동일하게 검증)
const ANALYSIS_MIN_DURATION_SEC = 60;

type Props = {
  call: CallHistoryItem;
  now: Date;
  onPartnerClick: (partnerId: number) => void;
};

export function CallCard({ call, now, onPartnerClick }: Props) {
  const meta = formatCallMeta(new Date(call.startedAt), call.durationSec, now);
  const { partner, analysisId, analysisStatus } = call;
  const isUnknown = partner === null;

  const navigate = useNavigate();
  const { mutate: triggerAnalysis } = useRequestAnalysis();

  const handleBodyClick = () => {
    if (!partner) return;
    onPartnerClick(partner.id);
  };

  const handleTriggerAnalysis = () => {
    triggerAnalysis(call.id);
  };

  const handleViewResult = () => {
    // analysisStatus === "COMPLETED" 일 때만 onViewResult 가 호출되므로
    // analysisId 는 항상 number. 안전망으로 null guard.
    if (analysisId === null) return;
    navigate(`/analyses/${analysisId}`);
  };

  // 1분 미만 통화는 분석을 새로 시작할 수 없다. 다만 이미 분석이 진행 중이거나
  // 완료된 통화(PROCESSING·COMPLETED)는 결과를 볼 수 있어야 하므로 버튼을 유지하고,
  // 그 외(WAITING_RECORDINGS·READY·FAILED)는 분석 시작/대기 계열이라 숨긴다.
  // 분석 가능 조건 안내는 목록 상단에 한 번만 노출한다.
  const isTooShortToAnalyze = call.durationSec < ANALYSIS_MIN_DURATION_SEC;
  const hasOngoingOrCompletedAnalysis =
    analysisStatus === "PROCESSING" || analysisStatus === "COMPLETED";
  const hideAnalysisButton = isTooShortToAnalyze && !hasOngoingOrCompletedAnalysis;

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
      {!hideAnalysisButton && (
        <AnalysisButton
          analysisStatus={analysisStatus}
          onTriggerAnalysis={handleTriggerAnalysis}
          onViewResult={handleViewResult}
        />
      )}
    </div>
  );
}
