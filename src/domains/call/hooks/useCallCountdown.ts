import { useEffect, useRef, useState } from "react";

/** 통화 상한시간 — 20분. 도달 시 자동 종료된다. */
export const CALL_CAP_MS = 20 * 60 * 1000;
/** 남은 시간이 이 값 이하면 "경고" 단계 (코랄 전환 + 1회 토스트). */
const WARN_AT_MS = 3 * 60 * 1000;
/** 남은 시간이 이 값 이하면 "마무리" 단계 (숫자 강조). */
const CLOSING_AT_MS = 60 * 1000;
const TICK_INTERVAL_MS = 1000;

export type CountdownPhase = "calm" | "warn" | "closing";

function phaseOf(remainingMs: number): CountdownPhase {
  if (remainingMs <= CLOSING_AT_MS) return "closing";
  if (remainingMs <= WARN_AT_MS) return "warn";
  return "calm";
}

export type UseCallCountdownOptions = {
  /** 통화가 연결되어 카운트다운이 흘러야 하는지. */
  active: boolean;
  /** 남은 시간이 0 에 도달했을 때 1회 호출 (자동 종료 트리거). */
  onTimeUp: () => void;
};

export type UseCallCountdownResult = {
  remainingMs: number;
  phase: CountdownPhase;
};

/**
 * 통화 20분 상한을 wallclock(timestamp) 기준으로 카운트다운한다.
 * setInterval 누적이 아니라 시작 시각 기준 계산이라, 모바일 백그라운드에서
 * 타이머가 throttle 되어도 복귀 시 정확한 남은 시간으로 보정된다.
 */
export function useCallCountdown({
  active,
  onTimeUp,
}: UseCallCountdownOptions): UseCallCountdownResult {
  const [remainingMs, setRemainingMs] = useState(CALL_CAP_MS);
  const startedAtRef = useRef<number | null>(null);
  const timeUpFiredRef = useRef(false);
  // onTimeUp 이 매 렌더 새로 와도 interval effect 를 재실행하지 않도록 ref 로 고정
  const onTimeUpRef = useRef(onTimeUp);
  onTimeUpRef.current = onTimeUp;

  useEffect(() => {
    if (!active) return;

    if (startedAtRef.current == null) {
      startedAtRef.current = Date.now();
    }

    const tick = () => {
      if (startedAtRef.current == null) return;
      const elapsed = Date.now() - startedAtRef.current;
      const next = Math.max(0, CALL_CAP_MS - elapsed);
      setRemainingMs(next);
      if (next === 0 && !timeUpFiredRef.current) {
        timeUpFiredRef.current = true;
        onTimeUpRef.current();
      }
    };

    const id = window.setInterval(tick, TICK_INTERVAL_MS);
    const onVisibilityChange = () => {
      if (!document.hidden) tick();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [active]);

  return { remainingMs, phase: phaseOf(remainingMs) };
}
