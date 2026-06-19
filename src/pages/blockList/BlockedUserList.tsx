import { useEffect, useRef } from "react";
import type { BlockListItem } from "@/domains/block/types";
import { BlockedUserItem } from "./BlockedUserItem";

type Props = {
  items: BlockListItem[];
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
  onUnblock: (target: { id: number; nickname: string }) => void;
};

export function BlockedUserList({
  items,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  onUnblock,
}: Props) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasNextPage) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver((entries) => {
      const [entry] = entries;
      if (entry?.isIntersecting && !isFetchingNextPage) {
        onLoadMore();
      }
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, onLoadMore]);

  return (
    <div className="scrollbar-none flex-1 overflow-y-auto px-5 pb-8 pt-3">
      <ul role="list" className="overflow-hidden rounded-[18px] bg-white shadow-card">
        {items.map((user, index) => (
          <div key={user.id} className={index > 0 ? "border-t border-gray-100" : ""}>
            <BlockedUserItem user={user} onUnblock={onUnblock} />
          </div>
        ))}
      </ul>
      <div ref={sentinelRef} aria-hidden="true" className="h-1" />
    </div>
  );
}
