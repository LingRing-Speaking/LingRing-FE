import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CountBadge } from "@/domains/friends/components/CountBadge";
import { RequestListItem } from "@/domains/friends/components/RequestListItem";
import { useAcceptFriendRequest } from "@/domains/friends/hooks/useAcceptFriendRequest";
import { usePendingRequests } from "@/domains/friends/hooks/usePendingRequests";
import { useReceivedCount } from "@/domains/friends/hooks/useReceivedCount";
import { useRemoveRelation } from "@/domains/friends/hooks/useRemoveRelation";
import { PageShell } from "@/components/PageShell";
import type { FriendDirection } from "@/domains/friends/types";

const SEGMENTS: { value: FriendDirection; label: string }[] = [
  { value: "RECEIVED", label: "받은" },
  { value: "SENT", label: "보낸" },
];

export function FriendRequestsPage() {
  const navigate = useNavigate();
  const [segment, setSegment] = useState<FriendDirection>("RECEIVED");

  const received = usePendingRequests("RECEIVED");
  const sent = usePendingRequests("SENT");
  const receivedCount = useReceivedCount();
  const acceptMutation = useAcceptFriendRequest();
  const removeMutation = useRemoveRelation();

  const active = segment === "RECEIVED" ? received : sent;
  const items = active.data?.pages.flatMap((page) => page.items) ?? [];

  const status = (() => {
    if (active.isError) return "error";
    if (active.isPending) return "loading";
    return "success";
  })();

  const isActioning = (userId: number) =>
    (acceptMutation.isPending && acceptMutation.variables === userId) ||
    (removeMutation.isPending && removeMutation.variables === userId);

  const emptyText = segment === "RECEIVED" ? "받은 요청이 없어요" : "보낸 요청이 없어요";

  return (
    <PageShell>
      <main className="relative flex flex-1 flex-col overflow-hidden bg-white">
        <header className="flex items-center gap-2 px-4 pb-1 pt-4">
          <button
            type="button"
            aria-label="뒤로"
            onClick={() => navigate(-1)}
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
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <h1 className="text-[17px] font-bold text-gray-900">친구 요청</h1>
        </header>

        <div className="flex gap-2 px-4 pb-3 pt-1">
          {SEGMENTS.map(({ value, label }) => {
            const isOn = segment === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setSegment(value)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-[13px] font-bold ${
                  isOn ? "bg-mint-500 text-white" : "bg-gray-100 text-gray-500"
                }`}
              >
                {label}
                {value === "RECEIVED" && <CountBadge count={receivedCount.data?.count ?? 0} />}
              </button>
            );
          })}
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
            <p className="text-[15px] font-medium text-gray-700">요청을 불러오지 못했어요.</p>
            <button
              type="button"
              onClick={() => active.refetch()}
              className="rounded-md bg-mint-500 px-5 py-2.5 text-[14px] font-semibold text-white"
            >
              다시 시도
            </button>
          </div>
        )}

        {status === "success" && items.length === 0 && (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-[14px] text-gray-400">{emptyText}</p>
          </div>
        )}

        {status === "success" && items.length > 0 && (
          <ul className="flex-1 overflow-y-auto">
            {items.map((item) => (
              <li key={item.userId}>
                <RequestListItem
                  item={item}
                  onAccept={(userId) => acceptMutation.mutate(userId)}
                  onRemove={(userId) => removeMutation.mutate(userId)}
                  actioning={isActioning(item.userId)}
                />
              </li>
            ))}
          </ul>
        )}
      </main>
    </PageShell>
  );
}
