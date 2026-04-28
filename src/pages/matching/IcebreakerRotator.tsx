import type { Icebreaker } from "@/domains/icebreaker/types";
import { useSentenceRotation } from "./useSentenceRotation";

type Props = {
  sentences: Icebreaker[];
  intervalMs: number;
  fadeMs: number;
};

export function IcebreakerRotator({ sentences, intervalMs, fadeMs }: Props) {
  const { index, currentItem, isSwapping } = useSentenceRotation(sentences, {
    intervalMs,
    fadeMs,
  });

  return (
    <section className="mt-2 mb-4 w-full" aria-live="polite">
      <p className="mx-1 mb-2.5 flex items-center gap-1.5 text-[12px] font-semibold leading-none text-coral-600">
        <span className="rounded-md bg-coral-100 px-1.5 py-[3px] text-[10px] font-bold tracking-wider text-coral-600">
          TIP
        </span>
        이런 문장으로 시작해보세요
      </p>
      <div className="relative flex min-h-[142px] flex-col justify-center overflow-hidden rounded-lg border border-gray-100 bg-white px-5 py-5 shadow-card">
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
