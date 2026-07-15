import type { QueryKey } from "@tanstack/react-query";
import {
  type TouchEvent as ReactTouchEvent,
  type TransitionEvent as ReactTransitionEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { Icebreaker } from "@/domains/icebreaker/types";
import { BookmarkStarButton } from "@/domains/userExpression/components/BookmarkStarButton";
import { useToggleBookmark } from "@/domains/userExpression/hooks/useToggleBookmark";
import { useSentenceRotation } from "./useSentenceRotation";

const SWIPE_RATIO = 0.25;
const FALLBACK_CARD_WIDTH = 320;
const SLIDE_DURATION_MS = 280;

type Props = {
  sentences: Icebreaker[];
  intervalMs: number;
  /**
   * 찜 별표의 낙관적 패치 대상이 되는 아이스브레이커 쿼리 키. 주어지면 current 슬롯의
   * 실제(id>0) 아이스브레이커에 별표를 노출한다. 폴백 문장만 있는 화면에서는 생략한다.
   */
  bookmarkQueryKey?: QueryKey;
};

type SlideTarget = "next" | "prev" | "snap";

export function IcebreakerRotator({
  sentences,
  intervalMs,
  bookmarkQueryKey,
}: Props) {
  const { index, currentItem, prevItem, nextItem, goNext, goPrev } =
    useSentenceRotation(sentences);

  const trackRef = useRef<HTMLDivElement>(null);
  const [cardWidth, setCardWidth] = useState(FALLBACK_CARD_WIDTH);
  const [dragX, setDragX] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const isPausedRef = useRef(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const pendingActionRef = useRef<SlideTarget | null>(null);
  const intervalIdRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useLayoutEffect(() => {
    const container = trackRef.current?.parentElement;
    if (!container) return;
    const measure = () => {
      const w = container.clientWidth;
      if (w > 0) setCardWidth(w);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const triggerAutoNext = useCallback(() => {
    if (isPausedRef.current) return;
    if (pendingActionRef.current !== null) return;
    pendingActionRef.current = "next";
    setIsAnimating(true);
    setDragX(-cardWidth);
  }, [cardWidth]);

  const startAutoTimer = useCallback(() => {
    if (intervalIdRef.current) clearInterval(intervalIdRef.current);
    if (sentences.length <= 1) return;
    intervalIdRef.current = setInterval(triggerAutoNext, intervalMs);
  }, [intervalMs, sentences.length, triggerAutoNext]);

  const stopAutoTimer = useCallback(() => {
    if (intervalIdRef.current) {
      clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }
  }, []);

  useEffect(() => {
    startAutoTimer();
    return () => stopAutoTimer();
  }, [startAutoTimer, stopAutoTimer]);

  const handleTouchStart = (e: ReactTouchEvent<HTMLDivElement>) => {
    if (pendingActionRef.current !== null) return;
    const t = e.touches[0];
    if (!t) return;
    touchStartRef.current = { x: t.clientX, y: t.clientY };
    isPausedRef.current = true;
  };

  const handleTouchMove = (e: ReactTouchEvent<HTMLDivElement>) => {
    const start = touchStartRef.current;
    if (!start) return;
    if (pendingActionRef.current !== null) return;
    const t = e.touches[0];
    if (!t) return;
    setDragX(t.clientX - start.x);
  };

  const handleTouchEnd = (e: ReactTouchEvent<HTMLDivElement>) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) {
      isPausedRef.current = false;
      return;
    }
    const t = e.changedTouches[0];
    if (!t) {
      pendingActionRef.current = "snap";
      setIsAnimating(true);
      setDragX(0);
      return;
    }
    const deltaX = t.clientX - start.x;
    const deltaY = t.clientY - start.y;
    const absX = Math.abs(deltaX);
    const isHorizontal = absX > Math.abs(deltaY);
    const threshold = cardWidth * SWIPE_RATIO;

    setIsAnimating(true);
    if (isHorizontal && absX >= threshold) {
      const target: SlideTarget = deltaX < 0 ? "next" : "prev";
      pendingActionRef.current = target;
      setDragX(deltaX < 0 ? -cardWidth : cardWidth);
    } else {
      pendingActionRef.current = "snap";
      setDragX(0);
    }
  };

  const handleTouchCancel = () => {
    touchStartRef.current = null;
    pendingActionRef.current = "snap";
    setIsAnimating(true);
    setDragX(0);
    isPausedRef.current = false;
  };

  const handleTransitionEnd = (e: ReactTransitionEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    setIsAnimating(false);

    if (action === "next") {
      goNext();
      setDragX(0);
      isPausedRef.current = false;
      startAutoTimer();
    } else if (action === "prev") {
      goPrev();
      setDragX(0);
      isPausedRef.current = false;
      startAutoTimer();
    } else if (action === "snap") {
      isPausedRef.current = false;
    }
  };

  const trackTransform = `translateX(calc(-33.3333% + ${dragX}px))`;
  const trackTransition = isAnimating
    ? `transform ${SLIDE_DURATION_MS}ms ease-out`
    : "none";

  return (
    <section className="mt-2 mb-4 w-full" aria-live="polite">
      <p className="mx-1 mb-2.5 flex items-center gap-1.5 text-[12px] font-semibold leading-none text-coral-600">
        <span className="rounded-md bg-coral-100 px-1.5 py-[3px] text-[10px] font-bold tracking-wider text-coral-600">
          TIP
        </span>
        이런 문장으로 시작해보세요
      </p>
      <div
        data-testid="rotator-card"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
        className="relative min-h-[142px] overflow-hidden rounded-lg border border-gray-100 bg-white shadow-card touch-pan-y"
      >
        <div
          ref={trackRef}
          data-testid="rotator-track"
          onTransitionEnd={handleTransitionEnd}
          className="flex"
          style={{
            width: "300%",
            transform: trackTransform,
            transition: trackTransition,
          }}
        >
          <SlotCard slot="prev" item={prevItem} />
          <SlotCard
            slot="current"
            item={currentItem}
            bookmarkQueryKey={bookmarkQueryKey}
          />
          <SlotCard slot="next" item={nextItem} />
        </div>
      </div>
      <div className="mt-3.5 flex justify-center gap-1.5">
        {sentences.map((s, i) => {
          const active = i === index;
          return (
            <span
              key={s.id}
              data-testid="rotator-dot"
              data-active={active}
              className={`h-1.5 rounded-full transition-all duration-200 ease-in-out ${
                active ? "w-[18px] bg-mint-500" : "w-1.5 bg-gray-200"
              }`}
            />
          );
        })}
      </div>
    </section>
  );
}

type SlotProps = {
  slot: "prev" | "current" | "next";
  item: Icebreaker | undefined;
  bookmarkQueryKey?: QueryKey;
};

function SlotCard({ slot, item, bookmarkQueryKey }: SlotProps) {
  // 별표는 current 슬롯의 실제(id>0) 아이스브레이커에만. 폴백(id<0)은 서버에 없어 제외.
  const showStar =
    slot === "current" && item !== undefined && item.id > 0 && bookmarkQueryKey;

  return (
    <div
      data-slot={slot}
      className="flex w-1/3 flex-shrink-0 flex-col justify-center min-h-[142px] px-5 py-5"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="m-0 text-[19px] font-bold leading-snug tracking-[-0.01em] text-gray-900">
          {item?.expression ?? ""}
        </p>
        {showStar && (
          <IcebreakerBookmarkStar item={item} queryKey={bookmarkQueryKey} />
        )}
      </div>
      <p className="m-0 text-[13px] font-medium leading-relaxed text-gray-600">
        {item?.meaning ?? ""}
      </p>
    </div>
  );
}

function IcebreakerBookmarkStar({
  item,
  queryKey,
}: {
  item: Icebreaker;
  queryKey: QueryKey;
}) {
  const { toggle, isPending } = useToggleBookmark<Icebreaker[]>({
    queryKey,
    patch: (list, nextBookmarkId) =>
      list.map((it) =>
        it.id === item.id ? { ...it, bookmarkId: nextBookmarkId } : it,
      ),
  });

  return (
    <BookmarkStarButton
      active={item.bookmarkId !== null}
      pending={isPending}
      onToggle={() =>
        toggle(item.bookmarkId, {
          source: "ICEBREAKER",
          icebreakerId: item.id,
        })
      }
    />
  );
}
