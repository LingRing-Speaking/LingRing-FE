import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockIsNative, mockAddListener, mockPushToken } = vi.hoisted(() => ({
  mockIsNative: vi.fn(),
  mockAddListener: vi.fn(),
  mockPushToken: { syncPushToken: vi.fn(), handleTokenRefresh: vi.fn() },
}));

vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: mockIsNative } }));
vi.mock("@capacitor-firebase/messaging", () => ({
  FirebaseMessaging: { addListener: mockAddListener },
}));
vi.mock("../pushToken", () => mockPushToken);

import { useAuthStore } from "@/domains/auth/store";
import { usePushTokenSync } from "./usePushTokenSync";

let tokenReceivedCallback: ((event: { token: string }) => void) | undefined;
const removeSpy = vi.fn();

function setAuthenticated(value: boolean) {
  useAuthStore.setState({ isAuthenticated: value });
}

describe("usePushTokenSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsNative.mockReturnValue(true);
    mockPushToken.syncPushToken.mockResolvedValue(undefined);
    mockPushToken.handleTokenRefresh.mockResolvedValue(undefined);
    tokenReceivedCallback = undefined;
    mockAddListener.mockImplementation(
      (_event: string, cb: (event: { token: string }) => void) => {
        tokenReceivedCallback = cb;
        return Promise.resolve({ remove: removeSpy });
      },
    );
  });

  afterEach(() => {
    setAuthenticated(false);
  });

  it("로그인 상태가 되면 토큰을 BE 에 등록한다", () => {
    setAuthenticated(true);
    renderHook(() => usePushTokenSync());

    expect(mockPushToken.syncPushToken).toHaveBeenCalledOnce();
  });

  it("FCM 이 토큰을 새로 발급하면 그 토큰으로 다시 등록한다", () => {
    setAuthenticated(true);
    renderHook(() => usePushTokenSync());

    tokenReceivedCallback?.({ token: "refreshed-token" });

    expect(mockAddListener).toHaveBeenCalledWith("tokenReceived", expect.any(Function));
    expect(mockPushToken.handleTokenRefresh).toHaveBeenCalledWith("refreshed-token");
  });

  it("로그아웃 상태면 등록하지 않고 리스너도 걸지 않는다", () => {
    setAuthenticated(false);
    renderHook(() => usePushTokenSync());

    expect(mockPushToken.syncPushToken).not.toHaveBeenCalled();
    expect(mockAddListener).not.toHaveBeenCalled();
  });

  it("웹(개발)에서는 아무것도 하지 않는다", () => {
    mockIsNative.mockReturnValue(false);
    setAuthenticated(true);
    renderHook(() => usePushTokenSync());

    expect(mockPushToken.syncPushToken).not.toHaveBeenCalled();
    expect(mockAddListener).not.toHaveBeenCalled();
  });

  it("언마운트하면 토큰 갱신 리스너를 해제한다", async () => {
    setAuthenticated(true);
    const { unmount } = renderHook(() => usePushTokenSync());
    await Promise.resolve(); // addListener 프라미스가 handle 을 넘겨줄 때까지

    unmount();

    expect(removeSpy).toHaveBeenCalledOnce();
  });

  it("등록이 실패해도 throw 하지 않는다 (다음 앱 실행 때 다시 시도)", async () => {
    mockPushToken.syncPushToken.mockRejectedValue(new Error("network"));
    setAuthenticated(true);

    expect(() => renderHook(() => usePushTokenSync())).not.toThrow();
    await Promise.resolve();
  });
});
