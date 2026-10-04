import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockCapacitor, mockPlugin } = vi.hoisted(() => ({
  mockCapacitor: { getPlatform: vi.fn(), isPluginAvailable: vi.fn() },
  mockPlugin: { openNotificationSettings: vi.fn() },
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: mockCapacitor,
  registerPlugin: vi.fn(() => mockPlugin),
}));

import {
  getIosAppSettingsUrl,
  getNotificationSettingsOpener,
  openAndroidNotificationSettings,
} from "./notificationSettings";

describe("getNotificationSettingsOpener", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // iOS 는 웹뷰 링크가 시스템으로 넘어가 앱 설정 화면이 열린다 — 네이티브 코드 없이 동작.
  it("iOS 는 앱 설정 링크로 연다", () => {
    mockCapacitor.getPlatform.mockReturnValue("ios");

    expect(getNotificationSettingsOpener()).toBe("ios-link");
  });

  it("Android 는 네이티브 플러그인이 있으면 플러그인으로 연다", () => {
    mockCapacitor.getPlatform.mockReturnValue("android");
    mockCapacitor.isPluginAvailable.mockReturnValue(true);

    expect(getNotificationSettingsOpener()).toBe("android-plugin");
    expect(mockCapacitor.isPluginAvailable).toHaveBeenCalledWith("AppSettings");
  });

  // 플러그인이 없는 옛 스토어 바이너리에 새 JS 가 OTA 로 올라간 경우.
  it("Android 에 플러그인이 없으면 열 수 없다", () => {
    mockCapacitor.getPlatform.mockReturnValue("android");
    mockCapacitor.isPluginAvailable.mockReturnValue(false);

    expect(getNotificationSettingsOpener()).toBeNull();
  });

  it("웹(개발)에서는 열 수 없다", () => {
    mockCapacitor.getPlatform.mockReturnValue("web");

    expect(getNotificationSettingsOpener()).toBeNull();
  });
});

describe("openAndroidNotificationSettings", () => {
  it("네이티브 플러그인으로 앱 알림 설정 화면을 연다", async () => {
    mockPlugin.openNotificationSettings.mockResolvedValue(undefined);

    await openAndroidNotificationSettings();

    expect(mockPlugin.openNotificationSettings).toHaveBeenCalledOnce();
  });
});

describe("getIosAppSettingsUrl", () => {
  const userAgentOf = (osVersion: string) =>
    `Mozilla/5.0 (iPhone; CPU iPhone OS ${osVersion} like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148`;

  // iOS 16+ 의 UIApplication.openNotificationSettingsURLString — 알림 화면으로 바로 간다 (기기 확인).
  it.each(["16_0", "17_5", "26_6"])("iOS %s 에서는 알림 설정 화면 URL", (osVersion) => {
    expect(getIosAppSettingsUrl(userAgentOf(osVersion))).toBe("app-settings:notifications");
  });

  it("iOS 15 에서는 앱 설정 화면 URL", () => {
    expect(getIosAppSettingsUrl(userAgentOf("15_8"))).toBe("app-settings:");
  });

  it("버전을 알 수 없으면 앱 설정 화면 URL", () => {
    expect(getIosAppSettingsUrl("unknown")).toBe("app-settings:");
  });
});
