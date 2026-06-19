import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageShell } from "@/components/PageShell";
import { UnblockConfirmModal } from "@/domains/block/components/UnblockConfirmModal";
import { useBlockedUsers } from "@/domains/block/hooks/useBlockedUsers";
import { BlockedUserList } from "./BlockedUserList";
import { EmptyBlockList } from "./EmptyBlockList";

type UnblockTarget = { id: number; nickname: string };

export function BlockListPage() {
  const navigate = useNavigate();
  const query = useBlockedUsers();
  const [unblockTarget, setUnblockTarget] = useState<UnblockTarget | null>(null);

  const status = (() => {
    if (query.isError) return "error";
    if (query.isPending) return "loading";
    return "success";
  })();

  const items = query.data?.pages.flatMap((p) => p.items) ?? [];
  const isEmpty = items.length === 0;

  return (
    <PageShell>
      <main className="relative flex flex-1 flex-col bg-gray-50">
        <div className="relative flex h-[52px] items-center bg-white px-2">
          <button
            type="button"
            aria-label="뒤로가기"
            onClick={() => navigate(-1)}
            className="flex h-10 w-10 items-center justify-center rounded-full text-gray-900 transition-colors active:bg-gray-100"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <h1 className="absolute left-1/2 -translate-x-1/2 text-[17px] font-bold tracking-tight text-gray-900">
            차단한 사용자
          </h1>
        </div>

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
            <p className="text-[15px] font-medium text-gray-700">차단 목록을 불러오지 못했어요.</p>
            <button
              type="button"
              onClick={() => query.refetch()}
              className="rounded-md bg-mint-500 px-5 py-2.5 text-[14px] font-semibold text-white"
            >
              다시 시도
            </button>
          </div>
        )}

        {status === "success" && isEmpty && <EmptyBlockList />}

        {status === "success" && !isEmpty && (
          <BlockedUserList
            items={items}
            hasNextPage={query.hasNextPage}
            isFetchingNextPage={query.isFetchingNextPage}
            onLoadMore={query.fetchNextPage}
            onUnblock={setUnblockTarget}
          />
        )}

        <UnblockConfirmModal
          target={unblockTarget}
          open={unblockTarget != null}
          onClose={() => setUnblockTarget(null)}
          onCancel={() => setUnblockTarget(null)}
        />
      </main>
    </PageShell>
  );
}
