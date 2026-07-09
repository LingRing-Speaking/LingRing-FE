import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/http";

vi.mock("@/lib/native/webrtcPlugin", () => ({
  isIosNative: () => false,
  NativeWebRTC: {},
}));
vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: vi.fn(), getPlatform: vi.fn() },
}));
vi.mock("./androidRecordingStore", () => ({
  listPendingAndroidRecordings: vi.fn(),
  readPendingRecording: vi.fn(),
  deletePendingRecording: vi.fn(),
}));
vi.mock("./recordingUploader", () => ({
  uploadRecording: vi.fn(),
  uploadRecordingBlob: vi.fn(),
}));

import { Capacitor } from "@capacitor/core";
import {
  deletePendingRecording,
  listPendingAndroidRecordings,
  readPendingRecording,
} from "./androidRecordingStore";
import { uploadRecordingBlob } from "./recordingUploader";
import { recoveryRun } from "./recordingRecovery";

const mockList = vi.mocked(listPendingAndroidRecordings);
const mockRead = vi.mocked(readPendingRecording);
const mockDelete = vi.mocked(deletePendingRecording);
const mockUpload = vi.mocked(uploadRecordingBlob);

const PENDING = {
  callId: 18,
  path: "recordings/call-18.webm",
  mimeType: "audio/webm",
  sizeBytes: 1024,
};
const BLOB = new Blob(["audio"], { type: "audio/webm" });

describe("recoveryRun (Android)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(Capacitor.getPlatform).mockReturnValue("android");
    mockRead.mockResolvedValue(BLOB);
    mockDelete.mockResolvedValue(undefined);
  });

  it("잔존 파일을 읽어 업로드하고 성공 시 삭제한다", async () => {
    mockList.mockResolvedValue([PENDING]);
    mockUpload.mockResolvedValue({ recordingId: 1 });

    await recoveryRun();

    expect(mockRead).toHaveBeenCalledWith(PENDING.path, PENDING.mimeType);
    expect(mockUpload).toHaveBeenCalledWith({ callId: 18, blob: BLOB });
    expect(mockDelete).toHaveBeenCalledWith(PENDING.path);
  });

  it("ApiError 400(만료)이면 파일을 삭제한다", async () => {
    mockList.mockResolvedValue([PENDING]);
    mockUpload.mockRejectedValue(new ApiError(400, "expired"));

    await recoveryRun();

    expect(mockDelete).toHaveBeenCalledWith(PENDING.path);
  });

  it("ApiError 403 이면 파일을 삭제한다", async () => {
    mockList.mockResolvedValue([PENDING]);
    mockUpload.mockRejectedValue(new ApiError(403, "forbidden"));

    await recoveryRun();

    expect(mockDelete).toHaveBeenCalledWith(PENDING.path);
  });

  it("네트워크 에러/5xx 면 파일을 보존한다 (다음 startup 재시도)", async () => {
    mockList.mockResolvedValue([
      PENDING,
      { ...PENDING, callId: 19, path: "recordings/call-19.webm" },
    ]);
    mockUpload
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockRejectedValueOnce(new ApiError(500, "server error"));

    await recoveryRun();

    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("sizeBytes 0 이면 업로드 없이 삭제한다", async () => {
    mockList.mockResolvedValue([{ ...PENDING, sizeBytes: 0 }]);

    await recoveryRun();

    expect(mockUpload).not.toHaveBeenCalled();
    expect(mockDelete).toHaveBeenCalledWith(PENDING.path);
  });

  it("한 파일이 실패해도 다음 파일 복구를 계속한다", async () => {
    mockList.mockResolvedValue([
      PENDING,
      { ...PENDING, callId: 19, path: "recordings/call-19.webm" },
    ]);
    mockUpload
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce({ recordingId: 2 });

    await recoveryRun();

    expect(mockUpload).toHaveBeenCalledTimes(2);
    expect(mockDelete).toHaveBeenCalledWith("recordings/call-19.webm");
  });

  it("웹(비네이티브)에서는 아무것도 하지 않는다", async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
    vi.mocked(Capacitor.getPlatform).mockReturnValue("web");

    await recoveryRun();

    expect(mockList).not.toHaveBeenCalled();
  });
});
