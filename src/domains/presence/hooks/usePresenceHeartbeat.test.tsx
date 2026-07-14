import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockAddListener } = vi.hoisted(() => ({ mockAddListener: vi.fn() }));
const { mockSendHeartbeat, mockGoOffline } = vi.hoisted(() => ({
  mockSendHeartbeat: vi.fn(),
  mockGoOffline: vi.fn(),
}));

vi.mock("@capacitor/app", () => ({ App: { addListener: mockAddListener } }));
vi.mock("../api/presenceApi", () => ({
  sendHeartbeat: mockSendHeartbeat,
  goOffline: mockGoOffline,
}));

import { useAuthStore } from "@/domains/auth/store";
import { usePresenceHeartbeat } from "./usePresenceHeartbeat";

const HEARTBEAT_INTERVAL_MS = 5000;

let appStateCallback: ((state: { isActive: boolean }) => void) | undefined;
const removeSpy = vi.fn();

function setAuthenticated(value: boolean) {
  useAuthStore.setState({ isAuthenticated: value });
}

describe("usePresenceHeartbeat", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockSendHeartbeat.mockResolvedValue(undefined);
    mockGoOffline.mockResolvedValue(undefined);
    appStateCallback = undefined;
    mockAddListener.mockImplementation(
      (_event: string, cb: (s: { isActive: boolean }) => void) => {
        appStateCallback = cb;
        return Promise.resolve({ remove: removeSpy });
      },
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    setAuthenticated(false);
  });

  it("인증 상태면 마운트 즉시 하트비트를 1회 보내고 이후 5초 주기로 반복한다", () => {
    setAuthenticated(true);
    renderHook(() => usePresenceHeartbeat());

    expect(mockSendHeartbeat).toHaveBeenCalledTimes(1); // 즉시 1회

    vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS);
    expect(mockSendHeartbeat).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS);
    expect(mockSendHeartbeat).toHaveBeenCalledTimes(3);
  });

  it("미인증이면 하트비트를 보내지 않는다", () => {
    setAuthenticated(false);
    renderHook(() => usePresenceHeartbeat());

    vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS * 3);
    expect(mockSendHeartbeat).not.toHaveBeenCalled();
  });

  it("백그라운드로 가면 하트비트를 멈추고 goOffline 을 1회 보낸다", () => {
    setAuthenticated(true);
    renderHook(() => usePresenceHeartbeat());
    expect(mockSendHeartbeat).toHaveBeenCalledTimes(1);

    appStateCallback?.({ isActive: false });
    expect(mockGoOffline).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS * 3);
    expect(mockSendHeartbeat).toHaveBeenCalledTimes(1); // 백그라운드 동안 추가 없음
  });

  it("포그라운드로 복귀하면 하트비트를 재개한다", () => {
    setAuthenticated(true);
    renderHook(() => usePresenceHeartbeat());
    appStateCallback?.({ isActive: false });
    expect(mockSendHeartbeat).toHaveBeenCalledTimes(1);

    appStateCallback?.({ isActive: true });
    expect(mockSendHeartbeat).toHaveBeenCalledTimes(2); // 복귀 즉시 1회

    vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS);
    expect(mockSendHeartbeat).toHaveBeenCalledTimes(3);
  });

  it("이미 포그라운드인데 active 이벤트가 또 와도 interval 이 중복 생성되지 않는다", () => {
    setAuthenticated(true);
    renderHook(() => usePresenceHeartbeat());
    expect(mockSendHeartbeat).toHaveBeenCalledTimes(1);

    appStateCallback?.({ isActive: true }); // 가드로 즉시 재전송/중복 interval 없음
    expect(mockSendHeartbeat).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS);
    expect(mockSendHeartbeat).toHaveBeenCalledTimes(2); // interval 1개만 유지
  });

  it("언마운트하면 interval 을 정리하고 리스너를 제거한다", async () => {
    setAuthenticated(true);
    const { unmount } = renderHook(() => usePresenceHeartbeat());
    await Promise.resolve(); // addListener().then 으로 handle 저장되도록 microtask flush

    unmount();
    expect(removeSpy).toHaveBeenCalledTimes(1);

    const callsBefore = mockSendHeartbeat.mock.calls.length;
    vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS * 3);
    expect(mockSendHeartbeat).toHaveBeenCalledTimes(callsBefore); // interval 멈춤
  });
});
