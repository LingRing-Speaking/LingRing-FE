import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockAddListener } = vi.hoisted(() => ({ mockAddListener: vi.fn() }));
vi.mock("@capacitor/app", () => ({ App: { addListener: mockAddListener } }));

import { useMatchingOpen } from "./useMatchingOpen";

const kst = (time: string) => new Date(`2026-10-03T${time}+09:00`);

let appStateCallback: ((state: { isActive: boolean }) => void) | undefined;
const removeSpy = vi.fn();

describe("useMatchingOpen", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    appStateCallback = undefined;
    mockAddListener.mockImplementation((_event: string, cb: (s: { isActive: boolean }) => void) => {
      appStateCallback = cb;
      return Promise.resolve({ remove: removeSpy });
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("현재 시각 기준으로 열림 여부를 돌려준다", () => {
    vi.setSystemTime(kst("21:00:00"));
    const { result } = renderHook(() => useMatchingOpen());

    expect(result.current).toBe(true);
  });

  it("화면을 켜 둔 채 20:00 이 되면 열린다", () => {
    vi.setSystemTime(kst("19:59:30"));
    const { result } = renderHook(() => useMatchingOpen());
    expect(result.current).toBe(false);

    act(() => vi.advanceTimersByTime(30_000));

    expect(result.current).toBe(true);
  });

  it("화면을 켜 둔 채 23:00 이 되면 닫힌다", () => {
    vi.setSystemTime(kst("22:59:59"));
    const { result } = renderHook(() => useMatchingOpen());

    act(() => vi.advanceTimersByTime(1_000));

    expect(result.current).toBe(false);
  });

  it("백그라운드에서 경계를 넘긴 뒤 포그라운드로 돌아오면 다시 판정한다", () => {
    vi.setSystemTime(kst("19:00:00"));
    const { result } = renderHook(() => useMatchingOpen());

    // 백그라운드에서는 타이머가 멈춰 있다가, 시계만 흘러간 상태로 복귀한다.
    vi.setSystemTime(kst("20:30:00"));
    act(() => appStateCallback?.({ isActive: true }));

    expect(result.current).toBe(true);
  });

  it("언마운트하면 앱 상태 리스너를 해제한다", async () => {
    vi.setSystemTime(kst("21:00:00"));
    const { unmount } = renderHook(() => useMatchingOpen());
    await act(async () => {}); // addListener 프라미스가 handle 을 넘겨줄 때까지

    unmount();

    expect(removeSpy).toHaveBeenCalledOnce();
  });
});
