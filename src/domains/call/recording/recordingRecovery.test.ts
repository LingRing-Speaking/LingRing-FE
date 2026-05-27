import { describe, it, expect, beforeEach, vi } from "vitest";
import { ApiError } from "@/lib/http";

vi.mock("@/lib/native/webrtcPlugin", () => ({
  isIosNative: () => true,
  NativeWebRTC: {
    listPendingRecordings: vi.fn(),
    deleteRecordingFile: vi.fn(),
  },
}));

vi.mock("./recordingUploader", () => ({
  uploadRecording: vi.fn(),
}));

import { NativeWebRTC } from "@/lib/native/webrtcPlugin";
import { uploadRecording } from "./recordingUploader";
import { recoveryRun } from "./recordingRecovery";

const mockListPending = vi.mocked(NativeWebRTC.listPendingRecordings);
const mockDeleteFile = vi.mocked(NativeWebRTC.deleteRecordingFile);
const mockUpload = vi.mocked(uploadRecording);

const PENDING_ITEM = {
  callId: 42,
  filePath: "/tmp/recording-42.m4a",
  sizeBytes: 1024,
};

describe("recoveryRun", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ApiError 401 이면 파일을 삭제한다", async () => {
    mockListPending.mockResolvedValue({ items: [PENDING_ITEM] });
    mockUpload.mockRejectedValue(new ApiError(401, "unauthorized"));

    await recoveryRun();

    expect(mockDeleteFile).toHaveBeenCalledWith({
      filePath: PENDING_ITEM.filePath,
    });
  });

  it("ApiError 403 이면 파일을 삭제한다", async () => {
    mockListPending.mockResolvedValue({ items: [PENDING_ITEM] });
    mockUpload.mockRejectedValue(new ApiError(403, "forbidden"));

    await recoveryRun();

    expect(mockDeleteFile).toHaveBeenCalledWith({
      filePath: PENDING_ITEM.filePath,
    });
  });

  it("ApiError 가 아닌 에러에 status 401 이 있어도 파일을 보존한다", async () => {
    const nativeError = Object.assign(new Error("network"), { status: 401 });
    mockListPending.mockResolvedValue({ items: [PENDING_ITEM] });
    mockUpload.mockRejectedValue(nativeError);

    await recoveryRun();

    expect(mockDeleteFile).not.toHaveBeenCalled();
  });

  it("ApiError 500 이면 파일을 보존한다 (다음 startup 재시도)", async () => {
    mockListPending.mockResolvedValue({ items: [PENDING_ITEM] });
    mockUpload.mockRejectedValue(new ApiError(500, "server error"));

    await recoveryRun();

    expect(mockDeleteFile).not.toHaveBeenCalled();
  });

  it("네트워크 에러이면 파일을 보존한다", async () => {
    mockListPending.mockResolvedValue({ items: [PENDING_ITEM] });
    mockUpload.mockRejectedValue(new TypeError("Failed to fetch"));

    await recoveryRun();

    expect(mockDeleteFile).not.toHaveBeenCalled();
  });

  it("sizeBytes 가 0 이면 업로드 없이 파일을 삭제한다", async () => {
    mockListPending.mockResolvedValue({
      items: [{ ...PENDING_ITEM, sizeBytes: 0 }],
    });

    await recoveryRun();

    expect(mockUpload).not.toHaveBeenCalled();
    expect(mockDeleteFile).toHaveBeenCalledWith({
      filePath: PENDING_ITEM.filePath,
    });
  });
});
