import { useNavigate } from "react-router-dom";
import { Avatar } from "@/components/Avatar";
import type { CallHistoryItem } from "@/domains/callHistory/types";
import { AnalysisButton } from "./AnalysisButton";
import { analysisExpiryDaysLeft, formatCallMeta } from "./timeBucket";

const UNKNOWN_PARTNER_NAME = "알 수 없음";

// 1분(60초) 이상 통화만 분석을 요청할 수 있다. (서버에서도 동일하게 검증)
const ANALYSIS_MIN_DURATION_SEC = 60;

// 분석 가능 기한이 이 일수 이내로 남으면 카드에 "만료 D-N" 칩을 띄워, 녹음이
// 삭제되기 전에 분석을 유도한다.
const EXPIRY_WARNING_DAYS = 7;

type Props = {
  call: CallHistoryItem;
  now: Date;
  onPartnerClick: (partnerId: number) => void;
  // 분석 트리거는 티켓 차감 확인/소진 모달을 거쳐야 하므로 카드가 직접 요청하지
  // 않고, 잔여 티켓과 모달을 쥔 페이지로 callId 만 올려보낸다.
  onAnalyze: (callId: number) => void;
};

export function CallCard({ call, now, onPartnerClick, onAnalyze }: Props) {
  const startedAtDate = new Date(call.startedAt);
  const meta = formatCallMeta(startedAtDate, call.durationSec, now);
  const { partner, analysisId, analysisStatus } = call;
  const isUnknown = partner === null;

  const navigate = useNavigate();

  const handleBodyClick = () => {
    if (!partner) return;
    onPartnerClick(partner.id);
  };

  const handleTriggerAnalysis = () => {
    onAnalyze(call.id);
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

  // 분석을 시작/재시도할 수 있는(READY·FAILED) 카드가 만료 임박(≤7일)이면 D-day
  // 칩으로 알려 녹음 삭제 전 분석을 유도한다. 이미 만료(EXPIRED)거나 분석이 끝난
  // (COMPLETED)·진행 중(PROCESSING) 카드엔 띄우지 않는다.
  const isAnalyzable =
    analysisStatus === "READY" || analysisStatus === "FAILED";
  const daysLeft = analysisExpiryDaysLeft(startedAtDate, call.durationSec, now);
  const showExpiryWarning =
    !hideAnalysisButton &&
    isAnalyzable &&
    daysLeft >= 1 &&
    daysLeft <= EXPIRY_WARNING_DAYS;

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
        <div className="flex flex-shrink-0 flex-col items-end gap-1">
          <AnalysisButton
            analysisStatus={analysisStatus}
            onTriggerAnalysis={handleTriggerAnalysis}
            onViewResult={handleViewResult}
          />
          {showExpiryWarning && <ExpiryWarningChip daysLeft={daysLeft} />}
        </div>
      )}
    </div>
  );
}

function ExpiryWarningChip({ daysLeft }: { daysLeft: number }) {
  return (
    <span
      aria-label={`분석 기한 ${daysLeft}일 남음`}
      className="inline-flex items-center gap-1 rounded-full bg-coral-100 px-2 py-1 text-[11px] font-bold leading-none tracking-tight text-coral-600"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-3 w-3"
      >
        <circle cx="12" cy="12" r="9" />
        <polyline points="12 7.5 12 12 15 13.8" />
      </svg>
      만료 D-{daysLeft}
    </span>
  );
}
