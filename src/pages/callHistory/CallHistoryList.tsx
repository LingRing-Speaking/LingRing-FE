import { useEffect, useMemo, useRef } from "react";
import type { CallHistoryItem } from "@/domains/callHistory/types";
import { CallCard } from "./CallCard";
import { classifyCalls } from "./timeBucket";

type Props = {
  items: CallHistoryItem[];
  now: Date;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
  onPartnerClick: (partnerId: number) => void;
};

export function CallHistoryList({
  items,
  now,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  onPartnerClick,
}: Props) {
  const groups = useMemo(() => classifyCalls(items, now), [items, now]);
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
    <div className="scrollbar-none flex-1 overflow-y-auto px-5 pb-24 pt-1">
      <h1 className="m-0 mt-2.5 text-[22px] font-extrabold leading-[1.3] tracking-[-0.02em] text-gray-900">
        통화 기록
      </h1>
      <p className="mb-5 mt-1 text-[11.5px] font-medium leading-none tracking-tight text-gray-400">
        ⓘ 1분 이상 통화부터 기록돼요
      </p>
      {groups.map((group, index) => (
        <section key={`${group.bucket}-${group.label}`}>
          <h2
            className={`mb-2.5 ml-1 text-[13px] font-bold leading-none tracking-tight text-gray-600 ${
              index === 0 ? "mt-1" : "mt-5"
            }`}
          >
            {group.label}
          </h2>
          <div className="flex flex-col gap-2.5">
            {group.items.map((call) => (
              <CallCard
                key={call.id}
                call={call}
                now={now}
                onPartnerClick={onPartnerClick}
              />
            ))}
          </div>
        </section>
      ))}
      <div ref={sentinelRef} aria-hidden="true" className="h-1" />
    </div>
  );
}
