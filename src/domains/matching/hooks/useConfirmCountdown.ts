import { useEffect, useState } from "react";

const TICK_INTERVAL_MS = 250;

type Result = {
  remainingMs: number | null;
  expired: boolean;
};

function computeRemaining(deadlineIso: string): number {
  const deadlineMs = new Date(deadlineIso).getTime();
  return Math.max(0, deadlineMs - Date.now());
}

export function useConfirmCountdown(deadlineIso: string | null): Result {
  const [remainingMs, setRemainingMs] = useState<number | null>(() =>
    deadlineIso === null ? null : computeRemaining(deadlineIso),
  );

  useEffect(() => {
    if (deadlineIso === null) {
      setRemainingMs(null);
      return;
    }
    setRemainingMs(computeRemaining(deadlineIso));
    const id = setInterval(() => {
      setRemainingMs(computeRemaining(deadlineIso));
    }, TICK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [deadlineIso]);

  return {
    remainingMs,
    expired: remainingMs !== null && remainingMs === 0,
  };
}
