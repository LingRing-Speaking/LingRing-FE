import { env } from "@/config/env";
import { useCallHistory } from "@/domains/callHistory/hooks/useCallHistory";
import { BottomTabBar } from "@/components/BottomTabBar";
import { CallHistoryList } from "./CallHistoryList";
import { EmptyCallHistory } from "./EmptyCallHistory";

export function CallHistoryPage() {
  const query = useCallHistory(env.devUserId);
  const now = new Date();

  const status = (() => {
    if (query.isError) return "error";
    if (query.isPending) return "loading";
    return "success";
  })();

  const items = query.data?.pages.flatMap((p) => p.items) ?? [];
  const isEmpty = items.length === 0;

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#E7EAEE] p-6">
      <div className="phone relative h-[812px] w-[375px] overflow-hidden rounded-[44px] bg-white shadow-[0_0_0_10px_#1A1D22,0_30px_60px_rgba(0,0,0,0.25)] md:h-dvh md:w-full md:rounded-none md:shadow-none">
        <header className="relative z-10 flex h-11 items-center justify-between bg-white px-6 text-[15px] font-semibold text-gray-900">
          <span>9:41</span>
        </header>

        <main className="relative flex h-[calc(100%-44px)] flex-col bg-gray-50">
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
              <p className="text-[15px] font-medium text-gray-700">
                통화 기록을 불러오지 못했어요.
              </p>
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
            />
          )}

          <BottomTabBar />
        </main>
      </div>
    </div>
  );
}
