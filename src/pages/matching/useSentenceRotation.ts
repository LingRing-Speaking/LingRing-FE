import { useCallback, useEffect, useRef, useState } from "react";

type Options = {
  intervalMs: number;
  fadeMs: number;
};

type Result<T> = {
  index: number;
  currentItem: T | undefined;
  isSwapping: boolean;
  goNext: () => void;
  goPrev: () => void;
  pause: () => void;
  resume: () => void;
};

export function useSentenceRotation<T>(items: T[], options: Options): Result<T> {
  const { intervalMs, fadeMs } = options;
  const [index, setIndex] = useState(0);
  const [isSwapping, setIsSwapping] = useState(false);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const intervalIdRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fadeTimeoutIdRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPausedRef = useRef(false);

  const tick = useCallback(() => {
    setIsSwapping(true);
    fadeTimeoutIdRef.current = setTimeout(() => {
      setIndex((prev) => {
        const total = itemsRef.current.length;
        if (total === 0) return 0;
        return (prev + 1) % total;
      });
      setIsSwapping(false);
    }, fadeMs);
  }, [fadeMs]);

  const startAutoTimer = useCallback(() => {
    if (intervalIdRef.current) clearInterval(intervalIdRef.current);
    intervalIdRef.current = setInterval(tick, intervalMs);
  }, [intervalMs, tick]);

  const stopAutoTimer = useCallback(() => {
    if (intervalIdRef.current) {
      clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (items.length === 0) {
      setIndex(0);
      return;
    }
    if (index >= items.length) {
      setIndex(0);
    }
  }, [items.length, index]);

  useEffect(() => {
    if (items.length <= 1) return;
    if (!isPausedRef.current) startAutoTimer();

    return () => {
      stopAutoTimer();
      if (fadeTimeoutIdRef.current) {
        clearTimeout(fadeTimeoutIdRef.current);
        fadeTimeoutIdRef.current = null;
      }
      setIsSwapping(false);
    };
  }, [items.length, startAutoTimer, stopAutoTimer]);

  const goNext = useCallback(() => {
    const total = itemsRef.current.length;
    if (total <= 1) return;
    setIndex((prev) => (prev + 1) % total);
    isPausedRef.current = false;
    startAutoTimer();
  }, [startAutoTimer]);

  const goPrev = useCallback(() => {
    const total = itemsRef.current.length;
    if (total <= 1) return;
    setIndex((prev) => (prev - 1 + total) % total);
    isPausedRef.current = false;
    startAutoTimer();
  }, [startAutoTimer]);

  const pause = useCallback(() => {
    isPausedRef.current = true;
    stopAutoTimer();
    if (fadeTimeoutIdRef.current) {
      clearTimeout(fadeTimeoutIdRef.current);
      fadeTimeoutIdRef.current = null;
      setIsSwapping(false);
    }
  }, [stopAutoTimer]);

  const resume = useCallback(() => {
    isPausedRef.current = false;
    if (itemsRef.current.length > 1) startAutoTimer();
  }, [startAutoTimer]);

  const safeIndex = items.length === 0 ? 0 : Math.min(index, items.length - 1);

  return {
    index: safeIndex,
    currentItem: items[safeIndex],
    isSwapping,
    goNext,
    goPrev,
    pause,
    resume,
  };
}
