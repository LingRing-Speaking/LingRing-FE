import { useMemo, useState } from "react";
import { BlockConfirmModal } from "@/domains/block/components/BlockConfirmModal";
import { useCallHistory } from "@/domains/callHistory/hooks/useCallHistory";
import { usePollProcessingCalls } from "@/domains/callHistory/hooks/usePollProcessingCalls";
import { ReportModal } from "@/domains/report/components/ReportModal";
import { PartnerProfileModal } from "@/domains/user/components/PartnerProfileModal";
import { BottomTabBar } from "@/components/BottomTabBar";
import { PageShell } from "@/components/PageShell";
import { CallHistoryList } from "./CallHistoryList";
import { EmptyCallHistory } from "./EmptyCallHistory";

export function CallHistoryPage() {
  const query = useCallHistory();
  const now = useMemo(() => new Date(), []);
  const [openPartnerId, setOpenPartnerId] = useState<number | null>(null);
  const [reportingPartnerId, setReportingPartnerId] = useState<number | null>(null);
  const [blockingPartnerId, setBlockingPartnerId] = useState<number | null>(null);

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

  const status = (() => {
    if (query.isError) return "error";
    if (query.isPending) return "loading";
    return "success";
  })();

  const items = query.data?.pages.flatMap((p) => p.items) ?? [];
  const isEmpty = items.length === 0;

  usePollProcessingCalls(items);

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
            hasNextPage={query.hasNextPage}
            isFetchingNextPage={query.isFetchingNextPage}
            onLoadMore={query.fetchNextPage}
            onPartnerClick={setOpenPartnerId}
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

        <BottomTabBar />
      </main>
    </PageShell>
  );
}
