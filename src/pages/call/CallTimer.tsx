import type { CountdownPhase } from "@/domains/call/hooks/useCallCountdown";

const pad2 = (n: number) => String(n).padStart(2, "0");

const PHASE_CLASS: Record<CountdownPhase, string> = {
  calm: "text-[28px] font-bold text-gray-900",
  warn: "text-[28px] font-bold text-coral-600",
  closing: "text-[34px] font-extrabold text-coral-600",
};

/**
 * 남은 통화 시간을 MM:SS 로 표시한다. 타이밍/단계 계산은 useCallCountdown 이
 * 담당하고, 이 컴포넌트는 받은 remainingMs/phase 를 그릴 뿐이다 (presentational).
 */
export function CallTimer({
  remainingMs,
  phase,
}: {
  remainingMs: number;
  phase: CountdownPhase;
}) {
  // 카운트다운은 올림 — 0.5초 남았어도 00:01 로 보여야 자연스럽다.
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const m = pad2(Math.floor(totalSeconds / 60));
  const s = pad2(totalSeconds % 60);

  return (
    <span
      aria-label="남은 통화 시간"
      data-phase={phase}
      className={`leading-none tracking-[-0.02em] tabular-nums transition-[color,font-size] duration-300 ${PHASE_CLASS[phase]}`}
    >
      {m}:{s}
    </span>
  );
}
