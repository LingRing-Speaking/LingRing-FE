import { useEffect, useRef, useState } from "react";

const TICK_INTERVAL_MS = 1000;
const pad2 = (n: number) => String(n).padStart(2, "0");

export function CallTimer({ active }: { active: boolean }) {
  const [elapsedMs, setElapsedMs] = useState(0);
  const startedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) return;

    if (startedAtRef.current == null) {
      startedAtRef.current = Date.now() - elapsedMs;
    }

    const tick = () => {
      if (startedAtRef.current == null) return;
      setElapsedMs(Date.now() - startedAtRef.current);
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
    // elapsedMs 는 의도적으로 deps 에서 제외 — startedAt 복원 시 1회만 참조
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const totalSeconds = Math.floor(elapsedMs / 1000);
  const m = pad2(Math.floor(totalSeconds / 60));
  const s = pad2(totalSeconds % 60);
  return (
    <span
      aria-label="통화 시간"
      className="text-[28px] font-bold leading-none tracking-[-0.02em] tabular-nums text-gray-900"
    >
      {m}:{s}
    </span>
  );
}
