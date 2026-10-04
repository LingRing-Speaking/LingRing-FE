import { useEffect, useState } from "react";
import { App } from "@capacitor/app";
import type { PluginListenerHandle } from "@capacitor/core";
import { isMatchingOpen, msUntilMatchingHoursChange } from "../matchingHours";

/**
 * 지금 랜덤 매칭이 열려 있는지(KST 20:00~23:00). 화면을 켜 둔 채 경계 시각을 넘기면 갱신되고,
 * 백그라운드에선 타이머가 멈추므로 포그라운드 복귀 시에도 다시 판정한다.
 */
export function useMatchingOpen(): boolean {
  const [isOpen, setIsOpen] = useState(() => isMatchingOpen(new Date()));

  useEffect(() => {
    let timeoutId: number | null = null;

    const refresh = () => {
      const now = new Date();
      setIsOpen(isMatchingOpen(now));
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(refresh, msUntilMatchingHoursChange(now));
    };

    refresh();

    let removed = false;
    let handle: PluginListenerHandle | null = null;
    void App.addListener("appStateChange", ({ isActive }) => {
      if (isActive) refresh();
    }).then((registered) => {
      if (removed) void registered.remove();
      else handle = registered;
    });

    return () => {
      removed = true;
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      void handle?.remove();
    };
  }, []);

  return isOpen;
}
