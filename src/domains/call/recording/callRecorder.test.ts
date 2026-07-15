import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: vi.fn() },
}));
vi.mock("@/lib/native/webrtcPlugin", () => ({
  NativeWebRTC: {
    startFileRecording: vi.fn(),
    stopFileRecording: vi.fn(),
  },
}));
vi.mock("./recordingUploader", () => ({
  uploadRecording: vi.fn(),
}));
vi.mock("@/lib/sentry", () => ({
  captureException: vi.fn(),
}));

import { Capacitor } from "@capacitor/core";
import { NativeWebRTC } from "@/lib/native/webrtcPlugin";
import { captureException } from "@/lib/sentry";
import { uploadRecording } from "./recordingUploader";
import { createCallRecorder } from "./callRecorder";

beforeEach(() => {
  vi.clearAllMocks();
});

// #193 Phase 3: iOS/Android 모두 native ADM 이 녹음하므로 recorder 는 native 경로 하나다.
describe("createCallRecorder — 플랫폼 선택", () => {
  it("네이티브 플랫폼은 recorder 를 만든다", () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    expect(createCallRecorder()).not.toBeNull();
  });

  it("웹(dev)은 null 을 반환한다 (녹음 비활성)", () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
    expect(createCallRecorder()).toBeNull();
  });
});

describe("native recorder", () => {
  beforeEach(() => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
  });

  it("start 는 native startFileRecording 을 호출한다", async () => {
    const recorder = createCallRecorder()!;
    await recorder.start(7);
    expect(NativeWebRTC.startFileRecording).toHaveBeenCalledWith({ callId: 7 });
  });

  it("finalize 는 stop 후 파일을 업로드한다", async () => {
    vi.mocked(NativeWebRTC.stopFileRecording).mockResolvedValue({
      filePath: "/data/rec/call-7.m4a",
      sizeBytes: 100,
    });
    const recorder = createCallRecorder()!;
    await recorder.finalize(7);
    expect(uploadRecording).toHaveBeenCalledWith({
      callId: 7,
      filePath: "/data/rec/call-7.m4a",
      sizeBytes: 100,
    });
  });

  it("finalize: 파일이 없으면 업로드하지 않는다", async () => {
    vi.mocked(NativeWebRTC.stopFileRecording).mockResolvedValue({});
    const recorder = createCallRecorder()!;
    await recorder.finalize(7);
    expect(uploadRecording).not.toHaveBeenCalled();
  });

  it("업로드 실패 시 throw 하지 않는다 (파일 보존 → 다음 startup recovery)", async () => {
    vi.mocked(NativeWebRTC.stopFileRecording).mockResolvedValue({
      filePath: "/data/rec/call-7.m4a",
      sizeBytes: 100,
    });
    vi.mocked(uploadRecording).mockRejectedValue(new Error("network"));
    const recorder = createCallRecorder()!;
    await expect(recorder.finalize(7)).resolves.toBeUndefined();
  });

  // 녹음은 상대방의 학습 자산 — 조용한 유실은 허용되지 않으므로 실패를 Sentry 로 보고한다.
  it("stopFileRecording 실패를 Sentry 로 보고한다", async () => {
    const error = new Error("native stop failed");
    vi.mocked(NativeWebRTC.stopFileRecording).mockRejectedValue(error);
    const recorder = createCallRecorder()!;

    await recorder.finalize(7);

    expect(captureException).toHaveBeenCalledWith(error, {
      tags: { source: "recording-stop" },
      extra: { callId: 7 },
    });
  });

  it("업로드 실패를 Sentry 로 보고한다", async () => {
    vi.mocked(NativeWebRTC.stopFileRecording).mockResolvedValue({
      filePath: "/data/rec/call-7.m4a",
      sizeBytes: 100,
    });
    const error = new Error("network");
    vi.mocked(uploadRecording).mockRejectedValue(error);
    const recorder = createCallRecorder()!;

    await recorder.finalize(7);

    expect(captureException).toHaveBeenCalledWith(error, {
      tags: { source: "recording-upload" },
      extra: { callId: 7 },
    });
  });
});
