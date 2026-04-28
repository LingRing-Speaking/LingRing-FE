import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSentenceRotation } from "./useSentenceRotation";

const items = [
  { id: 1, label: "a" },
  { id: 2, label: "b" },
  { id: 3, label: "c" },
];

describe("useSentenceRotation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("초기에는 첫 번째 아이템과 index 0 을 반환한다", () => {
    const { result } = renderHook(() =>
      useSentenceRotation(items, { intervalMs: 1000, fadeMs: 100 }),
    );

    expect(result.current.index).toBe(0);
    expect(result.current.currentItem).toEqual(items[0]);
    expect(result.current.isSwapping).toBe(false);
  });

  it("intervalMs 가 지나면 다음 아이템으로 전환된다", () => {
    const { result } = renderHook(() =>
      useSentenceRotation(items, { intervalMs: 1000, fadeMs: 100 }),
    );

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.isSwapping).toBe(true);

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current.index).toBe(1);
    expect(result.current.currentItem).toEqual(items[1]);
    expect(result.current.isSwapping).toBe(false);
  });

  it("마지막 아이템 다음에는 첫 번째로 wrap 한다", () => {
    const { result } = renderHook(() =>
      useSentenceRotation(items, { intervalMs: 1000, fadeMs: 100 }),
    );

    act(() => {
      vi.advanceTimersByTime((1000 + 100) * 3);
    });

    expect(result.current.index).toBe(0);
  });

  it("items 길이가 줄어들면 index 가 새 길이에 맞게 wrap 된다", () => {
    const { result, rerender } = renderHook(
      ({ list }: { list: typeof items }) =>
        useSentenceRotation(list, { intervalMs: 1000, fadeMs: 100 }),
      { initialProps: { list: items } },
    );

    act(() => {
      vi.advanceTimersByTime((1000 + 100) * 2);
    });
    expect(result.current.index).toBe(2);

    rerender({ list: items.slice(0, 2) });

    expect(result.current.index).toBe(0);
    expect(result.current.currentItem).toEqual(items[0]);
  });

  it("빈 배열이면 currentItem 은 undefined 다", () => {
    const { result } = renderHook(() =>
      useSentenceRotation([], { intervalMs: 1000, fadeMs: 100 }),
    );

    expect(result.current.currentItem).toBeUndefined();
    expect(result.current.index).toBe(0);
  });
});
