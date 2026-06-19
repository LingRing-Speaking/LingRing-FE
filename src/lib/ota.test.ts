import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockNotifyAppReady, mockAddListener, mockIsNativePlatform } = vi.hoisted(
  () => ({
    mockNotifyAppReady: vi.fn().mockResolvedValue({}),
    mockAddListener: vi.fn().mockResolvedValue({ remove: vi.fn() }),
    mockIsNativePlatform: vi.fn(),
  }),
);

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => mockIsNativePlatform(),
  },
}));

vi.mock("@capgo/capacitor-updater", () => ({
  CapacitorUpdater: {
    notifyAppReady: mockNotifyAppReady,
    addListener: mockAddListener,
  },
}));

import { initializeOtaUpdater } from "./ota";

describe("initializeOtaUpdater", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("웹 환경에서는 plugin 을 건드리지 않는다", async () => {
    mockIsNativePlatform.mockReturnValue(false);

    await initializeOtaUpdater();

    expect(mockNotifyAppReady).not.toHaveBeenCalled();
    expect(mockAddListener).not.toHaveBeenCalled();
  });

  it("네이티브 환경에서 notifyAppReady 를 정확히 한 번 호출한다", async () => {
    mockIsNativePlatform.mockReturnValue(true);

    await initializeOtaUpdater();

    expect(mockNotifyAppReady).toHaveBeenCalledTimes(1);
  });

  it("네이티브 환경에서 진단용 이벤트 리스너를 모두 등록한다", async () => {
    mockIsNativePlatform.mockReturnValue(true);

    await initializeOtaUpdater();

    const registeredEvents = mockAddListener.mock.calls.map(([name]) => name);
    expect(registeredEvents).toEqual([
      "updateAvailable",
      "downloadComplete",
      "downloadFailed",
      "updateFailed",
      "appReloaded",
    ]);
  });
});
