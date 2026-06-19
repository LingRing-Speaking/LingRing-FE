import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockNotifyAppReady,
  mockAddListener,
  mockIsNativePlatform,
  mockHttpGet,
  mockCurrent,
  mockDownload,
  mockNext,
} = vi.hoisted(() => ({
  mockNotifyAppReady: vi.fn().mockResolvedValue({}),
  mockAddListener: vi.fn().mockResolvedValue({ remove: vi.fn() }),
  mockIsNativePlatform: vi.fn(),
  mockHttpGet: vi.fn(),
  mockCurrent: vi.fn(),
  mockDownload: vi.fn(),
  mockNext: vi.fn().mockResolvedValue({}),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => mockIsNativePlatform(),
  },
  CapacitorHttp: {
    get: mockHttpGet,
  },
}));

vi.mock("@capgo/capacitor-updater", () => ({
  CapacitorUpdater: {
    notifyAppReady: mockNotifyAppReady,
    addListener: mockAddListener,
    current: mockCurrent,
    download: mockDownload,
    next: mockNext,
  },
}));

import { checkForUpdate, initializeOtaUpdater } from "./ota";

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

describe("checkForUpdate", () => {
  const MANIFEST_URL = "https://ota.lingring.site/manifest.json";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("VITE_OTA_UPDATE_URL", MANIFEST_URL);
    mockCurrent.mockResolvedValue({ bundle: { version: "0.0.1" } });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("manifest 버전이 현재와 다르면 download 후 next 로 적용을 예약한다", async () => {
    const downloaded = { id: "bundle-1", version: "0.0.2" };
    mockDownload.mockResolvedValue(downloaded);
    mockHttpGet.mockResolvedValue({
      status: 200,
      data: {
        version: "0.0.2",
        url: "https://ota.lingring.site/app-0.0.2.zip",
        checksum: "abc123",
      },
    });

    await checkForUpdate();

    expect(mockHttpGet).toHaveBeenCalledWith(
      expect.objectContaining({ url: MANIFEST_URL }),
    );
    expect(mockDownload).toHaveBeenCalledWith({
      version: "0.0.2",
      url: "https://ota.lingring.site/app-0.0.2.zip",
      checksum: "abc123",
    });
    expect(mockNext).toHaveBeenCalledWith(downloaded);
  });

  it("manifest 버전이 현재와 같으면 download 하지 않는다", async () => {
    mockCurrent.mockResolvedValue({ bundle: { version: "0.0.2" } });
    mockHttpGet.mockResolvedValue({
      status: 200,
      data: {
        version: "0.0.2",
        url: "https://ota.lingring.site/app-0.0.2.zip",
        checksum: "abc123",
      },
    });

    await checkForUpdate();

    expect(mockDownload).not.toHaveBeenCalled();
    expect(mockNext).not.toHaveBeenCalled();
  });

  it("VITE_OTA_UPDATE_URL 이 없으면 네트워크 요청을 하지 않는다", async () => {
    vi.stubEnv("VITE_OTA_UPDATE_URL", "");

    await checkForUpdate();

    expect(mockHttpGet).not.toHaveBeenCalled();
  });

  it("manifest 요청이 실패해도 예외를 던지지 않는다", async () => {
    mockHttpGet.mockRejectedValue(new Error("network down"));

    await expect(checkForUpdate()).resolves.toBeUndefined();
    expect(mockDownload).not.toHaveBeenCalled();
  });

  it("manifest 응답이 2xx 가 아니면 download 하지 않는다", async () => {
    mockHttpGet.mockResolvedValue({ status: 404, data: "" });

    await checkForUpdate();

    expect(mockDownload).not.toHaveBeenCalled();
  });
});
