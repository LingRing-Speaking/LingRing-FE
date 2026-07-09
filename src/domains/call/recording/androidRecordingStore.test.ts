import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@capacitor/filesystem", () => ({
  Directory: { Data: "DATA" },
  Filesystem: {
    writeFile: vi.fn().mockResolvedValue(undefined),
    appendFile: vi.fn().mockResolvedValue(undefined),
    readdir: vi.fn(),
    readFile: vi.fn(),
    deleteFile: vi.fn().mockResolvedValue(undefined),
  },
}));

import { Filesystem } from "@capacitor/filesystem";
import {
  createAndroidRecordingStore,
  deletePendingRecording,
  listPendingAndroidRecordings,
  readPendingRecording,
} from "./androidRecordingStore";

const fs = vi.mocked(Filesystem);

function base64ToText(b64: string): string {
  return atob(b64);
}

beforeEach(() => {
  vi.clearAllMocks();
  fs.writeFile.mockResolvedValue(undefined as never);
  fs.appendFile.mockResolvedValue(undefined as never);
  fs.deleteFile.mockResolvedValue(undefined as never);
});

describe("createAndroidRecordingStore", () => {
  it("첫 append 전에 파일을 truncate 생성하고 chunk 를 base64 로 append 한다", async () => {
    const store = createAndroidRecordingStore(7, "audio/webm;codecs=opus");

    await store.append(new Blob(["hello"], { type: "audio/webm" }));

    // truncate: 빈 데이터 writeFile (recursive 로 디렉토리 생성 포함)
    expect(fs.writeFile).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "recordings/call-7.webm",
        directory: "DATA",
        data: "",
        recursive: true,
      }),
    );
    expect(fs.appendFile).toHaveBeenCalledTimes(1);
    const appendArg = fs.appendFile.mock.calls[0][0];
    expect(appendArg.path).toBe("recordings/call-7.webm");
    expect(appendArg.directory).toBe("DATA");
    expect(base64ToText(appendArg.data as string)).toBe("hello");
  });

  it("audio/mp4 는 .mp4 확장자를 쓴다", async () => {
    const store = createAndroidRecordingStore(3, "audio/mp4");

    await store.append(new Blob(["x"]));

    expect(fs.appendFile.mock.calls[0][0].path).toBe("recordings/call-3.mp4");
  });

  it("append 는 직렬화된다 — 앞 append 가 끝나기 전에 다음 appendFile 을 호출하지 않는다", async () => {
    let resolveFirst!: () => void;
    fs.appendFile
      .mockImplementationOnce(
        () => new Promise<void>((r) => (resolveFirst = r)) as never,
      )
      .mockResolvedValue(undefined as never);

    const store = createAndroidRecordingStore(7, "audio/webm");
    const first = store.append(new Blob(["a"]));
    const second = store.append(new Blob(["b"]));

    // 첫 appendFile 이 pending 인 동안 두 번째는 대기해야 한다
    await vi.waitFor(() => expect(fs.appendFile).toHaveBeenCalledTimes(1));
    resolveFirst();
    await Promise.all([first, second]);

    expect(fs.appendFile).toHaveBeenCalledTimes(2);
    expect(base64ToText(fs.appendFile.mock.calls[0][0].data as string)).toBe("a");
    expect(base64ToText(fs.appendFile.mock.calls[1][0].data as string)).toBe("b");
  });

  it("append 실패는 throw 하지 않는다 (녹음 본선에 영향 없음)", async () => {
    fs.appendFile.mockRejectedValue(new Error("disk full") as never);
    const store = createAndroidRecordingStore(7, "audio/webm");

    await expect(store.append(new Blob(["a"]))).resolves.toBeUndefined();
  });

  it("remove 는 해당 파일을 삭제한다", async () => {
    const store = createAndroidRecordingStore(7, "audio/webm");
    await store.append(new Blob(["a"]));

    await store.remove();

    expect(fs.deleteFile).toHaveBeenCalledWith(
      expect.objectContaining({ path: "recordings/call-7.webm", directory: "DATA" }),
    );
  });
});

describe("listPendingAndroidRecordings", () => {
  it("recordings 디렉토리의 call-<id>.<ext> 파일을 파싱해 반환한다", async () => {
    fs.readdir.mockResolvedValue({
      files: [
        { name: "call-12.webm", size: 300, type: "file" },
        { name: "call-9.mp4", size: 500, type: "file" },
        { name: "junk.txt", size: 1, type: "file" },
      ],
    } as never);

    const items = await listPendingAndroidRecordings();

    expect(items).toEqual([
      {
        callId: 12,
        path: "recordings/call-12.webm",
        mimeType: "audio/webm",
        sizeBytes: 300,
      },
      {
        callId: 9,
        path: "recordings/call-9.mp4",
        mimeType: "audio/mp4",
        sizeBytes: 500,
      },
    ]);
  });

  it("디렉토리가 없으면(readdir 실패) 빈 배열을 반환한다", async () => {
    fs.readdir.mockRejectedValue(new Error("not found") as never);

    await expect(listPendingAndroidRecordings()).resolves.toEqual([]);
  });
});

describe("readPendingRecording / deletePendingRecording", () => {
  it("readFile 의 base64 를 mimeType Blob 으로 복원한다", async () => {
    fs.readFile.mockResolvedValue({ data: btoa("audio-bytes") } as never);

    const blob = await readPendingRecording("recordings/call-12.webm", "audio/webm");

    expect(blob.type).toBe("audio/webm");
    expect(await blob.text()).toBe("audio-bytes");
  });

  it("deletePendingRecording 은 파일을 삭제한다", async () => {
    await deletePendingRecording("recordings/call-12.webm");

    expect(fs.deleteFile).toHaveBeenCalledWith(
      expect.objectContaining({ path: "recordings/call-12.webm", directory: "DATA" }),
    );
  });
});
