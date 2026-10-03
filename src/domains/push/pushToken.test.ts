import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as PushTokenModule from "./pushToken";

const { mockCapacitor, mockMessaging, mockApi } = vi.hoisted(() => ({
  mockCapacitor: { isNativePlatform: vi.fn(), getPlatform: vi.fn() },
  mockMessaging: {
    checkPermissions: vi.fn(),
    requestPermissions: vi.fn(),
    getToken: vi.fn(),
  },
  mockApi: { registerDeviceToken: vi.fn(), unregisterDeviceToken: vi.fn() },
}));

vi.mock("@capacitor/core", () => ({ Capacitor: mockCapacitor }));
vi.mock("@capacitor-firebase/messaging", () => ({ FirebaseMessaging: mockMessaging }));
vi.mock("./api/deviceTokenApi", () => mockApi);

// 마지막으로 등록한 토큰을 모듈 상태로 들고 있으므로 테스트마다 새로 import 한다.
let pushToken: typeof PushTokenModule;

function givenNative(platform: "ios" | "android" = "ios") {
  mockCapacitor.isNativePlatform.mockReturnValue(true);
  mockCapacitor.getPlatform.mockReturnValue(platform);
}

function givenPermission(receive: "granted" | "denied" | "prompt") {
  mockMessaging.checkPermissions.mockResolvedValue({ receive });
}

beforeEach(async () => {
  vi.clearAllMocks();
  vi.resetModules();
  mockMessaging.getToken.mockResolvedValue({ token: "fcm-token" });
  mockApi.registerDeviceToken.mockResolvedValue(undefined);
  mockApi.unregisterDeviceToken.mockResolvedValue(undefined);
  pushToken = await import("./pushToken");
});

describe("syncPushToken", () => {
  it("네이티브에서 알림 권한이 허용돼 있으면 FCM 토큰을 플랫폼과 함께 등록한다", async () => {
    givenNative("android");
    givenPermission("granted");

    await pushToken.syncPushToken();

    expect(mockApi.registerDeviceToken).toHaveBeenCalledWith({
      token: "fcm-token",
      platform: "android",
    });
  });

  it("알림 권한이 없으면 토큰을 받지도 등록하지도 않는다", async () => {
    givenNative();
    givenPermission("prompt");

    await pushToken.syncPushToken();

    expect(mockMessaging.getToken).not.toHaveBeenCalled();
    expect(mockApi.registerDeviceToken).not.toHaveBeenCalled();
  });

  // 포그라운드 복귀마다 다시 부르므로, 이미 등록한 토큰은 BE 에 중복으로 보내지 않는다.
  it("이번 실행에서 이미 등록한 토큰이면 다시 등록하지 않는다", async () => {
    givenNative();
    givenPermission("granted");

    await pushToken.syncPushToken();
    await pushToken.syncPushToken();

    expect(mockApi.registerDeviceToken).toHaveBeenCalledOnce();
  });

  it("웹(개발)에서는 플러그인을 부르지 않는다", async () => {
    mockCapacitor.isNativePlatform.mockReturnValue(false);

    await pushToken.syncPushToken();

    expect(mockMessaging.checkPermissions).not.toHaveBeenCalled();
    expect(mockApi.registerDeviceToken).not.toHaveBeenCalled();
  });
});

describe("handleTokenRefresh", () => {
  it("권한이 허용돼 있으면 갱신된 토큰을 등록한다", async () => {
    givenNative("ios");
    givenPermission("granted");

    await pushToken.handleTokenRefresh("refreshed-token");

    expect(mockApi.registerDeviceToken).toHaveBeenCalledWith({
      token: "refreshed-token",
      platform: "ios",
    });
  });

  it("권한이 없으면 갱신된 토큰을 등록하지 않는다", async () => {
    givenNative();
    givenPermission("denied");

    await pushToken.handleTokenRefresh("refreshed-token");

    expect(mockApi.registerDeviceToken).not.toHaveBeenCalled();
  });
});

describe("enablePush", () => {
  it("권한 요청이 허용되면 토큰을 등록하고 true 를 돌려준다", async () => {
    givenNative();
    mockMessaging.requestPermissions.mockResolvedValue({ receive: "granted" });
    givenPermission("granted");

    await expect(pushToken.enablePush()).resolves.toBe(true);
    expect(mockApi.registerDeviceToken).toHaveBeenCalledOnce();
  });

  it("권한 요청이 거부되면 등록하지 않고 false 를 돌려준다", async () => {
    givenNative();
    mockMessaging.requestPermissions.mockResolvedValue({ receive: "denied" });

    await expect(pushToken.enablePush()).resolves.toBe(false);
    expect(mockApi.registerDeviceToken).not.toHaveBeenCalled();
  });

  // 웹(개발)에는 OS 알림 권한이 없으므로 허용된 것으로 본다 — 개발 중에도 알림 토글을 켤 수 있게.
  it("웹(개발)에서는 권한을 요청하지 않고 true 를 돌려준다", async () => {
    mockCapacitor.isNativePlatform.mockReturnValue(false);

    await expect(pushToken.enablePush()).resolves.toBe(true);
    expect(mockMessaging.requestPermissions).not.toHaveBeenCalled();
  });
});

describe("unregisterPushToken", () => {
  it("이번 실행에서 등록한 토큰을 해제한다", async () => {
    givenNative();
    givenPermission("granted");
    await pushToken.syncPushToken();

    await pushToken.unregisterPushToken();

    expect(mockApi.unregisterDeviceToken).toHaveBeenCalledWith("fcm-token");
  });

  it("해제한 뒤 다시 부르면 아무것도 하지 않는다", async () => {
    givenNative();
    givenPermission("granted");
    await pushToken.syncPushToken();
    await pushToken.unregisterPushToken();

    await pushToken.unregisterPushToken();

    expect(mockApi.unregisterDeviceToken).toHaveBeenCalledOnce();
  });

  it("등록한 토큰이 없으면 해제 API 를 부르지 않는다", async () => {
    await pushToken.unregisterPushToken();

    expect(mockApi.unregisterDeviceToken).not.toHaveBeenCalled();
  });
});

describe("getPushPermission", () => {
  it.each(["granted", "denied", "prompt"] as const)("네이티브에서는 OS 권한 상태(%s)를 그대로 돌려준다", async (receive) => {
    givenNative();
    givenPermission(receive);

    await expect(pushToken.getPushPermission()).resolves.toBe(receive);
  });

  it("웹(개발)에서는 granted", async () => {
    mockCapacitor.isNativePlatform.mockReturnValue(false);

    await expect(pushToken.getPushPermission()).resolves.toBe("granted");
  });
});
