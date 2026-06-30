import { useEffect, useRef, useState } from "react";
import type { CountdownPhase } from "@/domains/call/hooks/useCallCountdown";

/** 경고 토스트가 화면에 떠 있는 시간. */
const AUTO_HIDE_MS = 3500;
const WARNING_TEXT = "3분 뒤 통화가 자동으로 끝나요";

/**
 * 남은 시간이 경고 단계(3분)에 진입하면 한 번만 떠올랐다 사라지는 토스트.
 * 모달이 아니라 대화를 끊지 않는 안내다.
 */
export function CountdownWarningToast({ phase }: { phase: CountdownPhase }) {
  const [visible, setVisible] = useState(false);
  const shownRef = useRef(false);

  useEffect(() => {
    if (phase !== "warn" || shownRef.current) return;
    shownRef.current = true;
    setVisible(true);
    const id = window.setTimeout(() => setVisible(false), AUTO_HIDE_MS);
    return () => window.clearTimeout(id);
  }, [phase]);

  if (!visible) return null;

  return (
    <div
      role="status"
      className="absolute left-1/2 top-[104px] z-[9] flex -translate-x-1/2 items-center gap-2 rounded-2xl bg-white px-4 py-3 text-[13px] font-semibold text-gray-800 shadow-card"
    >
      <span aria-hidden="true" className="h-[7px] w-[7px] rounded-full bg-coral-500" />
      {WARNING_TEXT}
    </div>
  );
}
