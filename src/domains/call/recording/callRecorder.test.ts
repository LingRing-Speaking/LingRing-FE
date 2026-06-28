import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: vi.fn(), getPlatform: vi.fn() },
}));
vi.mock("@/lib/native/webrtcPlugin", () => ({
  isIosNative: vi.fn(),
  NativeWebRTC: {
    startFileRecording: vi.fn(),
    stopFileRecording: vi.fn(),
  },
}));
vi.mock("./recordingUploader", () => ({
  uploadRecording: vi.fn(),
  uploadRecordingBlob: vi.fn(),
}));

import { Capacitor } from "@capacitor/core";
import { isIosNative, NativeWebRTC } from "@/lib/native/webrtcPlugin";
import { uploadRecording, uploadRecordingBlob } from "./recordingUploader";
import { createCallRecorder } from "./callRecorder";

// jsdom 은 MediaRecorder 가 없으므로 제어 가능한 목으로 대체.
class MockMediaRecorder {
  static isTypeSupported = (t: string) => t === "audio/webm;codecs=opus";
  state: "inactive" | "recording" = "inactive";
  mimeType: string;
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  constructor(_stream: MediaStream, opts?: { mimeType?: string }) {
    this.mimeType = opts?.mimeType ?? "";
  }
  start() {
    this.state = "recording";
  }
  stop() {
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob(["audio-bytes"], { type: "audio/webm" }) });
    this.onstop?.();
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("MediaRecorder", MockMediaRecorder);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createCallRecorder — 플랫폼 선택", () => {
  it("iOS 는 recorder 를 만든다", () => {
    vi.mocked(isIosNative).mockReturnValue(true);
    expect(createCallRecorder(() => null)).not.toBeNull();
  });

  it("Android 네이티브는 recorder 를 만든다", () => {
    vi.mocked(isIosNative).mockReturnValue(false);
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(Capacitor.getPlatform).mockReturnValue("android");
    expect(createCallRecorder(() => null)).not.toBeNull();
  });

  it("웹(비네이티브)은 null 을 반환한다 (녹음 비활성)", () => {
    vi.mocked(isIosNative).mockReturnValue(false);
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
    vi.mocked(Capacitor.getPlatform).mockReturnValue("web");
    expect(createCallRecorder(() => null)).toBeNull();
  });
});

describe("iOS recorder", () => {
  beforeEach(() => {
    vi.mocked(isIosNative).mockReturnValue(true);
  });

  it("start 는 native startFileRecording 을 호출한다", async () => {
    const recorder = createCallRecorder(() => null)!;
    await recorder.start(7);
    expect(NativeWebRTC.startFileRecording).toHaveBeenCalledWith({ callId: 7 });
  });

  it("finalize 는 stop 후 파일을 업로드한다", async () => {
    vi.mocked(NativeWebRTC.stopFileRecording).mockResolvedValue({
      filePath: "/tmp/7.m4a",
      sizeBytes: 100,
    });
    const recorder = createCallRecorder(() => null)!;
    await recorder.finalize(7);
    expect(uploadRecording).toHaveBeenCalledWith({
      callId: 7,
      filePath: "/tmp/7.m4a",
      sizeBytes: 100,
    });
  });

  it("finalize: 파일이 없으면 업로드하지 않는다", async () => {
    vi.mocked(NativeWebRTC.stopFileRecording).mockResolvedValue({});
    const recorder = createCallRecorder(() => null)!;
    await recorder.finalize(7);
    expect(uploadRecording).not.toHaveBeenCalled();
  });
});

describe("Android web recorder", () => {
  beforeEach(() => {
    vi.mocked(isIosNative).mockReturnValue(false);
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(Capacitor.getPlatform).mockReturnValue("android");
  });

  it("start→finalize 시 마이크 스트림을 녹음해 blob 을 업로드한다", async () => {
    const stream = {} as MediaStream;
    const recorder = createCallRecorder(() => stream)!;
    await recorder.start(9);
    await recorder.finalize(9);

    expect(uploadRecordingBlob).toHaveBeenCalledTimes(1);
    const arg = vi.mocked(uploadRecordingBlob).mock.calls[0][0];
    expect(arg.callId).toBe(9);
    expect(arg.blob.size).toBeGreaterThan(0);
  });

  it("로컬 스트림이 없으면 녹음/업로드하지 않는다", async () => {
    const recorder = createCallRecorder(() => null)!;
    await recorder.start(9);
    await recorder.finalize(9);
    expect(uploadRecordingBlob).not.toHaveBeenCalled();
  });
});
