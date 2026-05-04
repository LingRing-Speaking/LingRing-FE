import { type TouchEvent as ReactTouchEvent, useRef } from "react";
import type { Icebreaker } from "@/domains/icebreaker/types";
import { useSentenceRotation } from "./useSentenceRotation";

const SWIPE_THRESHOLD_PX = 50;

type Props = {
  sentences: Icebreaker[];
  intervalMs: number;
  fadeMs: number;
};

export function IcebreakerRotator({ sentences, intervalMs, fadeMs }: Props) {
  const { index, currentItem, isSwapping, goNext, goPrev, pause, resume } =
    useSentenceRotation(sentences, { intervalMs, fadeMs });

  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = (e: ReactTouchEvent<HTMLDivElement>) => {
    const t = e.touches[0];
    if (!t) return;
    touchStartRef.current = { x: t.clientX, y: t.clientY };
    pause();
  };

  const handleTouchEnd = (e: ReactTouchEvent<HTMLDivElement>) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) {
      resume();
      return;
    }
    const t = e.changedTouches[0];
    if (!t) {
      resume();
      return;
    }
    const deltaX = t.clientX - start.x;
    const deltaY = t.clientY - start.y;
    const absX = Math.abs(deltaX);
    const isHorizontalSwipe = absX >= SWIPE_THRESHOLD_PX && absX > Math.abs(deltaY);

    if (isHorizontalSwipe) {
      if (deltaX < 0) goNext();
      else goPrev();
      return;
    }
    resume();
  };

  const handleTouchCancel = () => {
    touchStartRef.current = null;
    resume();
  };

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
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
        className="relative flex min-h-[142px] flex-col justify-center overflow-hidden rounded-lg border border-gray-100 bg-white px-5 py-5 shadow-card touch-pan-y"
      >
        <p
          className={`m-0 mb-2 text-[19px] font-bold leading-snug tracking-[-0.01em] text-gray-900 transition-[opacity,transform] ease-in-out ${
            isSwapping ? "-translate-y-1.5 opacity-0" : "translate-y-0 opacity-100"
          }`}
          style={{ transitionDuration: `${fadeMs}ms` }}
        >
          {currentItem?.expression ?? ""}
        </p>
        <p
          className={`m-0 text-[13px] font-medium leading-relaxed text-gray-600 transition-[opacity,transform] ease-in-out ${
            isSwapping ? "-translate-y-1.5 opacity-0" : "translate-y-0 opacity-100"
          }`}
          style={{ transitionDuration: `${fadeMs}ms` }}
        >
          {currentItem?.meaning ?? ""}
        </p>
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
