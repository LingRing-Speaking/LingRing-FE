import { useCallback, useEffect, useRef, useState } from "react";

type Result<T> = {
  index: number;
  currentItem: T | undefined;
  prevItem: T | undefined;
  nextItem: T | undefined;
  goNext: () => void;
  goPrev: () => void;
};

export function useSentenceRotation<T>(items: T[]): Result<T> {
  const [index, setIndex] = useState(0);
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
  }, [items.length, index]);

  const goNext = useCallback(() => {
    const total = itemsRef.current.length;
    if (total <= 1) return;
    setIndex((prev) => (prev + 1) % total);
  }, []);

  const goPrev = useCallback(() => {
    const total = itemsRef.current.length;
    if (total <= 1) return;
    setIndex((prev) => (prev - 1 + total) % total);
  }, []);

  const total = items.length;
  const safeIndex = total === 0 ? 0 : Math.min(index, total - 1);

  return {
    index: safeIndex,
    currentItem: items[safeIndex],
    prevItem: total === 0 ? undefined : items[(safeIndex - 1 + total) % total],
    nextItem: total === 0 ? undefined : items[(safeIndex + 1) % total],
    goNext,
    goPrev,
  };
}
