import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BlockConfirmModal } from "@/domains/block/components/BlockConfirmModal";
import { useAnalysisQuota } from "@/domains/callHistory/hooks/useAnalysisQuota";
import { useCallHistory } from "@/domains/callHistory/hooks/useCallHistory";
import { usePollTransientCalls } from "@/domains/callHistory/hooks/usePollTransientCalls";
import { useRequestAnalysis } from "@/domains/callHistory/hooks/useRequestAnalysis";
import { ReportModal } from "@/domains/report/components/ReportModal";
import { PartnerProfileModal } from "@/domains/user/components/PartnerProfileModal";
import { BottomTabBar } from "@/components/BottomTabBar";
import { PageShell } from "@/components/PageShell";
import { ApiError } from "@/lib/http";
import {
  AnalysisConfirmModal,
  AnalysisExhaustedModal,
  AnalysisUnavailableModal,
} from "./AnalysisQuotaModals";
import { CallHistoryList } from "./CallHistoryList";
import { EmptyCallHistory } from "./EmptyCallHistory";

const TICKET_EXHAUSTED_STATUS = 403;
// 녹음 보관 기간 만료 등으로 분석을 거절할 때 서버가 주는 상태 코드.
const ANALYSIS_BLOCKED_STATUS = 400;

export function CallHistoryPage() {
  const query = useCallHistory();
  const quota = useAnalysisQuota();
  const queryClient = useQueryClient();
  const { mutate: triggerAnalysis } = useRequestAnalysis();
  const now = useMemo(() => new Date(), []);
  const [openPartnerId, setOpenPartnerId] = useState<number | null>(null);
  const [reportingPartnerId, setReportingPartnerId] = useState<number | null>(null);
  const [blockingPartnerId, setBlockingPartnerId] = useState<number | null>(null);
  // 차감 확인 대상 통화. null 이면 확인 모달이 닫힌 상태.
  const [confirmCallId, setConfirmCallId] = useState<number | null>(null);
  const [showExhausted, setShowExhausted] = useState(false);
  // 서버가 분석을 거절(400, 예: 녹음 만료)했을 때 보여줄 사유. null 이면 닫힘.
  const [unavailableMessage, setUnavailableMessage] = useState<string | null>(
    null,
  );

  const closeReport = () => {
    setReportingPartnerId(null);
    setOpenPartnerId(null);
  };
  const cancelReport = () => setReportingPartnerId(null);

  const closeBlock = () => {
    setBlockingPartnerId(null);
    setOpenPartnerId(null);
  };
  const cancelBlock = () => setBlockingPartnerId(null);

  // 잔여 티켓이 0 인 게 확실하면 요청 없이 바로 소진 안내, 아니면(있거나 아직
  // 모를 때) 차감 확인 모달을 띄운다. 차감의 최종 권위는 서버라 확인 후 403 이
  // 오면 그때도 소진 모달로 떨어진다.
  const handleAnalyze = (callId: number) => {
    const remaining = quota.data
      ? quota.data.freeTicket + quota.data.paidTicket
      : null;
    if (remaining === 0) {
      setShowExhausted(true);
      return;
    }
    setConfirmCallId(callId);
  };

  const handleConfirmAnalyze = () => {
    const callId = confirmCallId;
    setConfirmCallId(null);
    if (callId === null) return;
    triggerAnalysis(callId, {
      onError: (error) => {
        if (!(error instanceof ApiError)) return;
        if (error.status === TICKET_EXHAUSTED_STATUS) {
          setShowExhausted(true);
        } else if (error.status === ANALYSIS_BLOCKED_STATUS) {
          // 녹음 보관 기간 만료 등으로 서버가 거절. 사유를 그대로 안내하고,
          // 목록을 새로고침해 해당 카드를 최신 상태(EXPIRED 등)로 갱신한다.
          setUnavailableMessage(error.message);
          void queryClient.invalidateQueries({ queryKey: ["calls"] });
        }
      },
    });
  };

  const status = (() => {
    if (query.isError) return "error";
    if (query.isPending) return "loading";
    return "success";
  })();

  const items = query.data?.pages.flatMap((p) => p.items) ?? [];
  const isEmpty = items.length === 0;

  usePollTransientCalls(items);

  return (
    <PageShell>
      <main className="relative flex flex-1 flex-col overflow-hidden bg-gray-50">
        {status === "loading" && (
          <div className="flex flex-1 items-center justify-center">
            <div
              role="status"
              aria-label="로딩 중"
              className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-mint-500"
            />
          </div>
        )}

        {status === "error" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4">
            <p className="text-[15px] font-medium text-gray-700">통화 기록을 불러오지 못했어요.</p>
            <button
              type="button"
              onClick={() => query.refetch()}
              className="rounded-md bg-mint-500 px-5 py-2.5 text-[14px] font-semibold text-white"
            >
              다시 시도
            </button>
          </div>
        )}

        {status === "success" && isEmpty && <EmptyCallHistory />}

        {status === "success" && !isEmpty && (
          <CallHistoryList
            items={items}
            now={now}
            quota={quota.data}
            hasNextPage={query.hasNextPage}
            isFetchingNextPage={query.isFetchingNextPage}
            onLoadMore={query.fetchNextPage}
            onPartnerClick={setOpenPartnerId}
            onAnalyze={handleAnalyze}
          />
        )}

        <PartnerProfileModal
          partnerId={openPartnerId}
          open={openPartnerId != null && reportingPartnerId == null && blockingPartnerId == null}
          onClose={() => setOpenPartnerId(null)}
          onReport={() => setReportingPartnerId(openPartnerId)}
          onBlock={() => setBlockingPartnerId(openPartnerId)}
        />

        <ReportModal
          partnerId={reportingPartnerId}
          open={reportingPartnerId != null}
          onClose={closeReport}
          onCancel={cancelReport}
        />

        <BlockConfirmModal
          partnerId={blockingPartnerId}
          open={blockingPartnerId != null}
          onClose={closeBlock}
          onCancel={cancelBlock}
        />

        <AnalysisConfirmModal
          open={confirmCallId != null}
          onConfirm={handleConfirmAnalyze}
          onCancel={() => setConfirmCallId(null)}
        />

        <AnalysisExhaustedModal
          open={showExhausted}
          onClose={() => setShowExhausted(false)}
        />

        <AnalysisUnavailableModal
          open={unavailableMessage !== null}
          message={unavailableMessage ?? ""}
          onClose={() => setUnavailableMessage(null)}
        />

        <BottomTabBar />
      </main>
    </PageShell>
  );
}
