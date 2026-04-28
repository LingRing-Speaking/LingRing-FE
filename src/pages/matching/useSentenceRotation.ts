import { useEffect, useRef, useState } from "react";

type Options = {
  intervalMs: number;
  fadeMs: number;
};

type Result<T> = {
  index: number;
  currentItem: T | undefined;
  isSwapping: boolean;
};

export function useSentenceRotation<T>(items: T[], options: Options): Result<T> {
  const { intervalMs, fadeMs } = options;
  const [index, setIndex] = useState(0);
  const [isSwapping, setIsSwapping] = useState(false);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  useEffect(() => {
    if (items.length === 0) {
      setIndex(0);
      return;
    }
    if (index >= items.length) {
      setIndex(0);
    }
  }, [items, index]);

  useEffect(() => {
    if (items.length <= 1) return;

    const cleanups: Array<() => void> = [];

    const intervalId = setInterval(() => {
      setIsSwapping(true);
      const fadeTimeoutId = setTimeout(() => {
        setIndex((prev) => {
          const total = itemsRef.current.length;
          if (total === 0) return 0;
          return (prev + 1) % total;
        });
        setIsSwapping(false);
      }, fadeMs);

      cleanups.push(() => clearTimeout(fadeTimeoutId));
    }, intervalMs);

    return () => {
      clearInterval(intervalId);
      cleanups.forEach((fn) => fn());
    };
  }, [items.length, intervalMs, fadeMs]);

  const safeIndex = items.length === 0 ? 0 : Math.min(index, items.length - 1);

  return {
    index: items.length === 0 ? 0 : safeIndex,
    currentItem: items[safeIndex],
    isSwapping,
  };
}
