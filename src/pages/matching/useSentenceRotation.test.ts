import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useSentenceRotation } from "./useSentenceRotation";

const items = [
  { id: 1, label: "a" },
  { id: 2, label: "b" },
  { id: 3, label: "c" },
];

describe("useSentenceRotation", () => {
  it("초기에는 첫 번째 아이템과 index 0 을 반환한다", () => {
    const { result } = renderHook(() => useSentenceRotation(items));

    expect(result.current.index).toBe(0);
    expect(result.current.currentItem).toEqual(items[0]);
  });

  it("prevItem 은 이전 인덱스(랩어라운드 포함)의 아이템이다", () => {
    const { result } = renderHook(() => useSentenceRotation(items));

    expect(result.current.prevItem).toEqual(items[items.length - 1]);
  });

  it("nextItem 은 다음 인덱스(랩어라운드 포함)의 아이템이다", () => {
    const { result } = renderHook(() => useSentenceRotation(items));

    expect(result.current.nextItem).toEqual(items[1]);
  });

  it("items 길이가 줄어들면 index 가 새 길이에 맞게 wrap 된다", () => {
    const { result, rerender } = renderHook(
      ({ list }: { list: typeof items }) => useSentenceRotation(list),
      { initialProps: { list: items } },
    );

    act(() => {
      result.current.goNext();
      result.current.goNext();
    });
    expect(result.current.index).toBe(2);

    rerender({ list: items.slice(0, 2) });

    expect(result.current.index).toBe(0);
    expect(result.current.currentItem).toEqual(items[0]);
  });

  it("빈 배열이면 currentItem/prevItem/nextItem 모두 undefined 다", () => {
    const { result } = renderHook(() => useSentenceRotation([]));

    expect(result.current.currentItem).toBeUndefined();
    expect(result.current.prevItem).toBeUndefined();
    expect(result.current.nextItem).toBeUndefined();
    expect(result.current.index).toBe(0);
  });

  it("goNext() 는 index 를 +1 한다", () => {
    const { result } = renderHook(() => useSentenceRotation(items));

    act(() => {
      result.current.goNext();
    });

    expect(result.current.index).toBe(1);
  });

  it("goNext() 는 마지막 index 에서 0 으로 wrap 한다", () => {
    const { result } = renderHook(() => useSentenceRotation(items));

    act(() => {
      result.current.goNext();
      result.current.goNext();
      result.current.goNext();
    });

    expect(result.current.index).toBe(0);
  });

  it("goPrev() 는 index 를 -1 한다", () => {
    const { result } = renderHook(() => useSentenceRotation(items));

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
    const { result } = renderHook(() => useSentenceRotation(items));

    act(() => {
      result.current.goPrev();
    });

    expect(result.current.index).toBe(items.length - 1);
  });

  it("문장이 1개면 goNext/goPrev 호출이 무시된다", () => {
    const { result } = renderHook(() => useSentenceRotation([items[0]]));

    act(() => {
      result.current.goNext();
      result.current.goPrev();
    });

    expect(result.current.index).toBe(0);
  });
});
