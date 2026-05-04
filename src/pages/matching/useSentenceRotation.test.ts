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

  it("items 가 fade 진행 중에 교체되어도 isSwapping 이 초기화된다", () => {
    const { result, rerender } = renderHook(
      ({ list }: { list: typeof items }) =>
        useSentenceRotation(list, { intervalMs: 1000, fadeMs: 100 }),
      { initialProps: { list: items } },
    );

    // 인터벌 틱 → isSwapping: true, fade timeout 아직 실행 전
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.isSwapping).toBe(true);

    // fade가 끝나기 전에 items 길이 변경 (deps 변경 → 인터벌 재생성, cleanup 실행)
    rerender({ list: items.slice(0, 2) });

    expect(result.current.isSwapping).toBe(false);
  });

  it("빈 배열이면 currentItem 은 undefined 다", () => {
    const { result } = renderHook(() =>
      useSentenceRotation([], { intervalMs: 1000, fadeMs: 100 }),
    );

    expect(result.current.currentItem).toBeUndefined();
    expect(result.current.index).toBe(0);
  });

  it("goNext() 는 index 를 +1 한다", () => {
    const { result } = renderHook(() =>
      useSentenceRotation(items, { intervalMs: 1000, fadeMs: 100 }),
    );

    act(() => {
      result.current.goNext();
    });

    expect(result.current.index).toBe(1);
  });

  it("goNext() 는 마지막 index 에서 0 으로 wrap 한다", () => {
    const { result } = renderHook(() =>
      useSentenceRotation(items, { intervalMs: 1000, fadeMs: 100 }),
    );

    act(() => {
      result.current.goNext();
      result.current.goNext();
      result.current.goNext();
    });

    expect(result.current.index).toBe(0);
  });

  it("goNext() 후 자동 타이머가 리셋된다 (intervalMs 직전엔 자동 진행 없음)", () => {
    const { result } = renderHook(() =>
      useSentenceRotation(items, { intervalMs: 1000, fadeMs: 100 }),
    );

    act(() => {
      vi.advanceTimersByTime(900);
    });
    act(() => {
      result.current.goNext();
    });
    expect(result.current.index).toBe(1);

    act(() => {
      vi.advanceTimersByTime(900);
    });
    expect(result.current.index).toBe(1);
  });

  it("goPrev() 는 index 를 -1 한다", () => {
    const { result } = renderHook(() =>
      useSentenceRotation(items, { intervalMs: 1000, fadeMs: 100 }),
    );

    act(() => {
      result.current.goNext();
    });
    expect(result.current.index).toBe(1);

    act(() => {
      result.current.goPrev();
    });
    expect(result.current.index).toBe(0);
  });

  it("goPrev() 는 index 0 에서 마지막으로 wrap 한다", () => {
    const { result } = renderHook(() =>
      useSentenceRotation(items, { intervalMs: 1000, fadeMs: 100 }),
    );

    act(() => {
      result.current.goPrev();
    });

    expect(result.current.index).toBe(items.length - 1);
  });

  it("goPrev() 후 자동 타이머가 리셋된다", () => {
    const { result } = renderHook(() =>
      useSentenceRotation(items, { intervalMs: 1000, fadeMs: 100 }),
    );

    act(() => {
      vi.advanceTimersByTime(900);
    });
    act(() => {
      result.current.goPrev();
    });
    expect(result.current.index).toBe(items.length - 1);

    act(() => {
      vi.advanceTimersByTime(900);
    });
    expect(result.current.index).toBe(items.length - 1);
  });

  it("pause() 후엔 시간이 흘러도 자동 진행하지 않는다", () => {
    const { result } = renderHook(() =>
      useSentenceRotation(items, { intervalMs: 1000, fadeMs: 100 }),
    );

    act(() => {
      result.current.pause();
    });
    act(() => {
      vi.advanceTimersByTime((1000 + 100) * 3);
    });

    expect(result.current.index).toBe(0);
  });

  it("resume() 후엔 자동 진행이 7초+fade 만에 재개된다", () => {
    const { result } = renderHook(() =>
      useSentenceRotation(items, { intervalMs: 1000, fadeMs: 100 }),
    );

    act(() => {
      result.current.pause();
    });
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.index).toBe(0);

    act(() => {
      result.current.resume();
    });
    act(() => {
      vi.advanceTimersByTime(1000 + 100);
    });
    expect(result.current.index).toBe(1);
  });

  it("문장이 1개면 goNext/goPrev 호출이 무시된다", () => {
    const { result } = renderHook(() =>
      useSentenceRotation([items[0]], { intervalMs: 1000, fadeMs: 100 }),
    );

    act(() => {
      result.current.goNext();
      result.current.goPrev();
    });

    expect(result.current.index).toBe(0);
  });
});
