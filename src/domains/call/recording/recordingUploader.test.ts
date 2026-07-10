import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: vi.fn() },
}));
vi.mock("@/lib/native/webrtcPlugin", () => ({
  NativeWebRTC: {
    uploadRecordingFile: vi.fn(),
    deleteRecordingFile: vi.fn(),
  },
}));
vi.mock("@/domains/call/api/recording", () => ({
  requestRecordingPresignedUrl: vi.fn(),
  createRecording: vi.fn(),
}));

import { Capacitor } from "@capacitor/core";
import { NativeWebRTC } from "@/lib/native/webrtcPlugin";
import { createRecording, requestRecordingPresignedUrl } from "@/domains/call/api/recording";
import { uploadRecording } from "./recordingUploader";

const INPUT = { callId: 3, filePath: "/data/rec/call-3.m4a", sizeBytes: 1024 };

describe("uploadRecording (native 공통)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(requestRecordingPresignedUrl).mockResolvedValue({
      url: "https://s3.example/put",
      key: "call-recordings/3/1/uuid",
    });
    vi.mocked(createRecording).mockResolvedValue({
      recordingId: 55,
      status: "UPLOADED",
    });
    vi.mocked(NativeWebRTC.uploadRecordingFile).mockResolvedValue({ statusCode: 200 });
    vi.mocked(NativeWebRTC.deleteRecordingFile).mockResolvedValue(undefined);
  });

  it("presign(audio/mp4) → native PUT → createRecording → 파일 삭제 순으로 진행한다", async () => {
    const result = await uploadRecording(INPUT);

    expect(requestRecordingPresignedUrl).toHaveBeenCalledWith(3, {
      contentType: "audio/mp4",
      contentLength: 1024,
    });
    expect(NativeWebRTC.uploadRecordingFile).toHaveBeenCalledWith({
      filePath: INPUT.filePath,
      url: "https://s3.example/put",
      contentType: "audio/mp4",
    });
    expect(createRecording).toHaveBeenCalledWith(3, {
      recordingKey: "call-recordings/3/1/uuid",
    });
    expect(NativeWebRTC.deleteRecordingFile).toHaveBeenCalledWith({
      filePath: INPUT.filePath,
    });
    expect(result).toEqual({ recordingId: 55 });
  });

  it("PUT 실패 시 throw 하고 파일을 삭제하지 않는다 (보존 → recovery)", async () => {
    vi.mocked(NativeWebRTC.uploadRecordingFile).mockRejectedValue(new Error("network"));

    await expect(uploadRecording(INPUT)).rejects.toThrow("network");
    expect(createRecording).not.toHaveBeenCalled();
    expect(NativeWebRTC.deleteRecordingFile).not.toHaveBeenCalled();
  });

  it("파일 삭제 실패는 무시하고 성공을 반환한다", async () => {
    vi.mocked(NativeWebRTC.deleteRecordingFile).mockRejectedValue(new Error("busy"));

    await expect(uploadRecording(INPUT)).resolves.toEqual({ recordingId: 55 });
  });

  it("웹(비네이티브)에서는 throw 한다", async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);

    await expect(uploadRecording(INPUT)).rejects.toThrow("네이티브 전용");
  });
});
