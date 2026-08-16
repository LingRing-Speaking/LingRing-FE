import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/http";

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
import { createCallRecorder, type CallRecorder } from "./callRecorder";

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
    // 업로드 재시도 백오프(누적 12초)를 실시간으로 기다리지 않도록.
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // 재시도 백오프의 setTimeout 을 모두 진행시켜 finalize 를 끝까지 돌린다.
  const runFinalize = async (recorder: CallRecorder, callId: number) => {
    const finalized = recorder.finalize(callId);
    await vi.runAllTimersAsync();
    await finalized;
  };

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

  it("업로드 실패 시 throw 하지 않는다 (파일 보존 → 다음 recovery)", async () => {
    vi.mocked(NativeWebRTC.stopFileRecording).mockResolvedValue({
      filePath: "/data/rec/call-7.m4a",
      sizeBytes: 100,
    });
    vi.mocked(uploadRecording).mockRejectedValue(new Error("network"));
    const recorder = createCallRecorder()!;

    const finalized = recorder.finalize(7);
    await vi.runAllTimersAsync();

    await expect(finalized).resolves.toBeUndefined();
  });

  // BE 는 HANGUP 직후 통화를 종료 처리하지만, WS 끊김은 10초 유예 뒤에야 종료로 확정한다.
  // 그 사이의 업로드는 400(CALL_ACTIVE)으로 거절되므로 유예를 넘겨 다시 시도해야 한다.
  it("400 이면 백오프 후 재시도해 결국 업로드한다", async () => {
    vi.mocked(NativeWebRTC.stopFileRecording).mockResolvedValue({
      filePath: "/data/rec/call-7.m4a",
      sizeBytes: 100,
    });
    vi.mocked(uploadRecording)
      .mockRejectedValueOnce(new ApiError(400, "진행 중인 통화는 녹음 업로드를 시작할 수 없습니다."))
      .mockResolvedValueOnce({ recordingId: 1 });
    const recorder = createCallRecorder()!;

    await runFinalize(recorder, 7);

    expect(uploadRecording).toHaveBeenCalledTimes(2);
    expect(captureException).not.toHaveBeenCalled();
  });

  it("재시도를 모두 소진하면 실패를 보고한다", async () => {
    vi.mocked(NativeWebRTC.stopFileRecording).mockResolvedValue({
      filePath: "/data/rec/call-7.m4a",
      sizeBytes: 100,
    });
    const error = new ApiError(400, "진행 중인 통화는 녹음 업로드를 시작할 수 없습니다.");
    vi.mocked(uploadRecording).mockRejectedValue(error);
    const recorder = createCallRecorder()!;

    await runFinalize(recorder, 7);

    expect(uploadRecording).toHaveBeenCalledTimes(3);
    expect(captureException).toHaveBeenCalledWith(error, {
      tags: { source: "recording-upload" },
      extra: { callId: 7 },
    });
  });

  // 403 은 이 계정으로는 영영 올릴 수 없다는 뜻 — 기다려도 풀리지 않는다.
  it("403 이면 재시도하지 않는다", async () => {
    vi.mocked(NativeWebRTC.stopFileRecording).mockResolvedValue({
      filePath: "/data/rec/call-7.m4a",
      sizeBytes: 100,
    });
    vi.mocked(uploadRecording).mockRejectedValue(new ApiError(403, "forbidden"));
    const recorder = createCallRecorder()!;

    await runFinalize(recorder, 7);

    expect(uploadRecording).toHaveBeenCalledTimes(1);
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

    await runFinalize(recorder, 7);

    expect(captureException).toHaveBeenCalledWith(error, {
      tags: { source: "recording-upload" },
      extra: { callId: 7 },
    });
  });
});
