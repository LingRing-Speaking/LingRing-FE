import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// uploadRecordingBlob 은 webrtcPlugin 을 쓰지 않지만, 모듈 import 시 registerPlugin 로딩을 피하려 목 처리.
vi.mock("@/lib/native/webrtcPlugin", () => ({
  isIosNative: vi.fn(() => false),
  NativeWebRTC: {},
}));
vi.mock("@/domains/call/api/recording", () => ({
  requestRecordingPresignedUrl: vi.fn(),
  createRecording: vi.fn(),
}));

import { createRecording, requestRecordingPresignedUrl } from "@/domains/call/api/recording";
import { uploadRecordingBlob } from "./recordingUploader";

describe("uploadRecordingBlob (Android web 경로)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requestRecordingPresignedUrl).mockResolvedValue({
      url: "https://s3.example/put",
      key: "recordings/3.webm",
    });
    vi.mocked(createRecording).mockResolvedValue({
      recordingId: 55,
      status: "UPLOADED",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, status: 200 })),
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("presign → S3 PUT → createRecording 순서로 업로드하고 content-type 의 codecs 를 제거한다", async () => {
    const blob = new Blob(["audio"], { type: "audio/webm;codecs=opus" });

    const result = await uploadRecordingBlob({ callId: 3, blob });

    expect(requestRecordingPresignedUrl).toHaveBeenCalledWith(3, {
      contentType: "audio/webm",
      contentLength: blob.size,
    });
    expect(fetch).toHaveBeenCalledWith(
      "https://s3.example/put",
      expect.objectContaining({
        method: "PUT",
        headers: { "Content-Type": "audio/webm" },
      }),
    );
    expect(createRecording).toHaveBeenCalledWith(3, {
      recordingKey: "recordings/3.webm",
    });
    expect(result).toEqual({ recordingId: 55 });
  });

  it("S3 PUT 실패 시 createRecording 을 호출하지 않고 throw 한다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 403 })),
    );
    const blob = new Blob(["audio"], { type: "audio/webm" });

    await expect(uploadRecordingBlob({ callId: 3, blob })).rejects.toThrow();
    expect(createRecording).not.toHaveBeenCalled();
  });
});
