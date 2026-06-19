import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockNotifyAppReady,
  mockAddListener,
  mockIsNativePlatform,
  mockCurrent,
  mockDownload,
  mockNext,
} = vi.hoisted(() => ({
  mockNotifyAppReady: vi.fn().mockResolvedValue({}),
  mockAddListener: vi.fn().mockResolvedValue({ remove: vi.fn() }),
  mockIsNativePlatform: vi.fn(),
  mockCurrent: vi.fn(),
  mockDownload: vi.fn(),
  mockNext: vi.fn().mockResolvedValue({}),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => mockIsNativePlatform(),
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
  const MANIFEST_URL = "http://localhost:8888/manifest.json";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("VITE_OTA_UPDATE_URL", MANIFEST_URL);
    mockCurrent.mockResolvedValue({ bundle: { version: "0.0.1" } });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("manifest 버전이 현재와 다르면 download 후 next 로 적용을 예약한다", async () => {
    const downloaded = { id: "bundle-1", version: "0.0.2" };
    mockDownload.mockResolvedValue(downloaded);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          version: "0.0.2",
          url: "http://localhost:8888/app-0.0.2.zip",
          checksum: "abc123",
        }),
      }),
    );

    await checkForUpdate();

    expect(mockDownload).toHaveBeenCalledWith({
      version: "0.0.2",
      url: "http://localhost:8888/app-0.0.2.zip",
      checksum: "abc123",
    });
    expect(mockNext).toHaveBeenCalledWith(downloaded);
  });

  it("manifest 버전이 현재와 같으면 download 하지 않는다", async () => {
    mockCurrent.mockResolvedValue({ bundle: { version: "0.0.2" } });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          version: "0.0.2",
          url: "http://localhost:8888/app-0.0.2.zip",
          checksum: "abc123",
        }),
      }),
    );

    await checkForUpdate();

    expect(mockDownload).not.toHaveBeenCalled();
    expect(mockNext).not.toHaveBeenCalled();
  });

  it("VITE_OTA_UPDATE_URL 이 없으면 네트워크 요청을 하지 않는다", async () => {
    vi.stubEnv("VITE_OTA_UPDATE_URL", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await checkForUpdate();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("manifest fetch 가 실패해도 예외를 던지지 않는다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network down")),
    );

    await expect(checkForUpdate()).resolves.toBeUndefined();
    expect(mockDownload).not.toHaveBeenCalled();
  });

  it("manifest 응답이 ok 가 아니면 download 하지 않는다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 404 }),
    );

    await checkForUpdate();

    expect(mockDownload).not.toHaveBeenCalled();
  });
});
