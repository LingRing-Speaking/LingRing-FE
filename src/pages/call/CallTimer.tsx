import { useEffect, useState } from "react";

const pad2 = (n: number) => String(n).padStart(2, "0");

export function CallTimer({ active }: { active: boolean }) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [active]);

  const m = pad2(Math.floor(seconds / 60));
  const s = pad2(seconds % 60);
  return (
    <span
      aria-label="통화 시간"
      className="text-[28px] font-bold leading-none tracking-[-0.02em] tabular-nums text-gray-900"
    >
      {m}:{s}
    </span>
  );
}
