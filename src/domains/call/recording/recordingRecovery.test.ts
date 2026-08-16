import { describe, it, expect, beforeEach, vi } from "vitest";
import { ApiError } from "@/lib/http";

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => true },
}));
vi.mock("@/lib/native/webrtcPlugin", () => ({
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

  // 인증 확립 전에 recovery 가 돌면 토큰 없는 요청이 401 을 받는다. 이걸 영구 거절로 오판해
  // 파일을 지우면 상대방의 녹음이 유실된다 (실제 발생한 사고).
  it("ApiError 401 이면 파일을 보존한다", async () => {
    mockListPending.mockResolvedValue({ items: [PENDING_ITEM] });
    mockUpload.mockRejectedValue(new ApiError(401, "unauthorized"));

    await recoveryRun();

    expect(mockDeleteFile).not.toHaveBeenCalled();
  });

  // BE 에러 응답에 code 필드가 없어 CALL_ACTIVE(기다리면 풀림)와 형식·크기 오류를 구분할 수
  // 없다. 구분이 불가능하면 남긴다.
  it("ApiError 400 이면 파일을 보존한다", async () => {
    mockListPending.mockResolvedValue({ items: [PENDING_ITEM] });
    mockUpload.mockRejectedValue(new ApiError(400, "진행 중인 통화는 녹음 업로드를 시작할 수 없습니다."));

    await recoveryRun();

    expect(mockDeleteFile).not.toHaveBeenCalled();
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

  // 인증 확립과 포그라운드 복귀가 연달아 오면 두 번 호출된다 — 같은 파일을 두 번 올리지 않는다.
  it("이미 실행 중이면 두 번째 호출은 아무것도 하지 않는다", async () => {
    let releaseUpload: () => void = () => {};
    mockListPending.mockResolvedValue({ items: [PENDING_ITEM] });
    mockUpload.mockImplementation(
      () => new Promise((resolve) => { releaseUpload = () => resolve({ recordingId: 1 }); }),
    );

    const first = recoveryRun();
    await Promise.resolve();
    const second = recoveryRun();
    await second;

    expect(mockUpload).toHaveBeenCalledTimes(1);

    releaseUpload();
    await first;
  });

  it("실행이 끝나면 다음 호출이 다시 돈다", async () => {
    mockListPending.mockResolvedValue({ items: [PENDING_ITEM] });
    mockUpload.mockResolvedValue({ recordingId: 1 });

    await recoveryRun();
    await recoveryRun();

    expect(mockUpload).toHaveBeenCalledTimes(2);
  });
});
