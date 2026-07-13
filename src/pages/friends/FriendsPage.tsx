import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FriendDeleteConfirmModal } from "@/domains/friends/components/FriendDeleteConfirmModal";
import { FriendList } from "@/domains/friends/components/FriendList";
import { FriendsEmpty } from "@/domains/friends/components/FriendsEmpty";
import { ReceivedRequestCard } from "@/domains/friends/components/ReceivedRequestCard";
import { useFriends } from "@/domains/friends/hooks/useFriends";
import { useReceivedCount } from "@/domains/friends/hooks/useReceivedCount";
import { useRemoveRelation } from "@/domains/friends/hooks/useRemoveRelation";
import { UserProfileModal } from "@/domains/user/components/UserProfileModal";
import { BottomTabBar } from "@/components/BottomTabBar";
import { PageShell } from "@/components/PageShell";

export function FriendsPage() {
  const navigate = useNavigate();
  const friends = useFriends();
  const receivedCount = useReceivedCount();
  const removeMutation = useRemoveRelation();

  // 프로필 모달 대상 userId. 그 위에 삭제 확인이 열리면 프로필 모달은 가린다.
  const [openUserId, setOpenUserId] = useState<number | null>(null);
  const [confirmingUserId, setConfirmingUserId] = useState<number | null>(null);

  const items = friends.data?.pages.flatMap((page) => page.items) ?? [];
  const count = receivedCount.data?.count ?? 0;
  const isEmpty = items.length === 0;

  const status = (() => {
    if (friends.isError) return "error";
    if (friends.isPending) return "loading";
    return "success";
  })();

  const goSearch = () => navigate("/friends/search");
  const goRequests = () => navigate("/friends/requests");

  const askRemove = (userId: number) => {
    setOpenUserId(null);
    setConfirmingUserId(userId);
  };

  const confirmRemove = () => {
    const userId = confirmingUserId;
    setConfirmingUserId(null);
    if (userId == null) return;
    removeMutation.mutate(userId);
  };

  return (
    <PageShell>
      <main className="relative flex flex-1 flex-col overflow-hidden bg-white">
        <header className="flex items-center justify-between px-5 pb-2 pt-4">
          <h1 className="text-[22px] font-extrabold tracking-[-0.02em] text-gray-900">친구</h1>
          <button
            type="button"
            aria-label="친구 검색"
            onClick={goSearch}
            className="flex h-9 w-9 items-center justify-center rounded-full text-gray-700 active:bg-gray-100"
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
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>
        </header>

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
            <p className="text-[15px] font-medium text-gray-700">친구 목록을 불러오지 못했어요.</p>
            <button
              type="button"
              onClick={() => friends.refetch()}
              className="rounded-md bg-mint-500 px-5 py-2.5 text-[14px] font-semibold text-white"
            >
              다시 시도
            </button>
          </div>
        )}

        {status === "success" && (
          <div className="flex flex-1 flex-col overflow-y-auto pb-24">
            {count > 0 && <ReceivedRequestCard count={count} onClick={goRequests} />}
            {isEmpty ? (
              <FriendsEmpty onSearch={goSearch} hasPendingRequest={count > 0} />
            ) : (
              <FriendList
                items={items}
                hasNextPage={friends.hasNextPage}
                isFetchingNextPage={friends.isFetchingNextPage}
                onLoadMore={friends.fetchNextPage}
                onSelect={setOpenUserId}
                onRemove={askRemove}
              />
            )}
          </div>
        )}

        <UserProfileModal
          userId={openUserId}
          open={openUserId != null && confirmingUserId == null}
          onClose={() => setOpenUserId(null)}
          actions={(profile) => (
            <div className="mt-2 flex justify-center py-2.5">
              <button
                type="button"
                onClick={() => askRemove(profile.id)}
                className="text-[13px] font-semibold tracking-tight text-coral-600 underline underline-offset-[3px] active:opacity-60"
              >
                친구 삭제
              </button>
            </div>
          )}
        />

        <FriendDeleteConfirmModal
          open={confirmingUserId != null}
          pending={removeMutation.isPending}
          onConfirm={confirmRemove}
          onCancel={() => setConfirmingUserId(null)}
        />

        <BottomTabBar />
      </main>
    </PageShell>
  );
}
