import { useEffect, useRef } from "react";
import type { FriendItem } from "../types";
import { FriendListItem } from "./FriendListItem";

type Props = {
  items: FriendItem[];
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
  onSelect: (userId: number) => void;
  onRemove: (userId: number) => void;
};

export function FriendList({
  items,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  onSelect,
  onRemove,
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
    <div className="flex-1">
      <p className="px-5 pb-1 pt-3 text-[12px] font-bold text-gray-400">내 친구</p>
      <ul>
        {items.map((item) => (
          <li key={item.userId}>
            <FriendListItem item={item} onSelect={onSelect} onRemove={onRemove} />
          </li>
        ))}
      </ul>
      <div ref={sentinelRef} aria-hidden="true" className="h-1" />
    </div>
  );
}
