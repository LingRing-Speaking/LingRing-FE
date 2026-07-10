import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";

vi.mock("./callRecorder", () => ({
  createCallRecorder: vi.fn(),
}));

import { createCallRecorder, type CallRecorder } from "./callRecorder";
import { useCallRecording } from "./useCallRecording";
import type { CallStatus } from "@/domains/call/hooks/useCallSession";

const createCallRecorderMock = vi.mocked(createCallRecorder);

function makeRecorder(): CallRecorder & {
  start: ReturnType<typeof vi.fn>;
  finalize: ReturnType<typeof vi.fn>;
} {
  return {
    start: vi.fn().mockResolvedValue(undefined),
    finalize: vi.fn().mockResolvedValue(undefined),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useCallRecording", () => {
  it("connected 진입 시 녹음을 시작한다", () => {
    const recorder = makeRecorder();
    createCallRecorderMock.mockReturnValue(recorder);

    renderHook(
      ({ status }: { status: CallStatus }) =>
        useCallRecording({ callId: 7, status }),
      { initialProps: { status: "connecting" as CallStatus } },
    );

    expect(recorder.start).not.toHaveBeenCalled();
  });

  it("status 가 ended 로 바뀌면 unmount 없이 즉시 finalize 한다", () => {
    const recorder = makeRecorder();
    createCallRecorderMock.mockReturnValue(recorder);

    const { rerender } = renderHook(
      ({ status }: { status: CallStatus }) =>
        useCallRecording({ callId: 7, status }),
      { initialProps: { status: "connecting" as CallStatus } },
    );

    rerender({ status: "connected" });
    expect(recorder.start).toHaveBeenCalledWith(7);

    rerender({ status: "ended" });
    expect(recorder.finalize).toHaveBeenCalledWith(7);
  });

  it("status 가 error 로 바뀌면 즉시 finalize 한다", () => {
    const recorder = makeRecorder();
    createCallRecorderMock.mockReturnValue(recorder);

    const { rerender } = renderHook(
      ({ status }: { status: CallStatus }) =>
        useCallRecording({ callId: 7, status }),
      { initialProps: { status: "connecting" as CallStatus } },
    );

    rerender({ status: "connected" });
    rerender({ status: "error" });

    expect(recorder.finalize).toHaveBeenCalledWith(7);
  });

  it("ended 후 unmount 되어도 finalize 는 한 번만 호출된다", () => {
    const recorder = makeRecorder();
    createCallRecorderMock.mockReturnValue(recorder);

    const { rerender, unmount } = renderHook(
      ({ status }: { status: CallStatus }) =>
        useCallRecording({ callId: 7, status }),
      { initialProps: { status: "connecting" as CallStatus } },
    );

    rerender({ status: "connected" });
    rerender({ status: "ended" });
    unmount();

    expect(recorder.finalize).toHaveBeenCalledTimes(1);
  });

  it("ended 도달 전에 unmount 되면 안전망으로 finalize 한다", () => {
    const recorder = makeRecorder();
    createCallRecorderMock.mockReturnValue(recorder);

    const { rerender, unmount } = renderHook(
      ({ status }: { status: CallStatus }) =>
        useCallRecording({ callId: 7, status }),
      { initialProps: { status: "connecting" as CallStatus } },
    );

    rerender({ status: "connected" });
    unmount();

    expect(recorder.finalize).toHaveBeenCalledWith(7);
  });

  it("녹음이 시작되지 않았으면 finalize 하지 않는다", () => {
    const recorder = makeRecorder();
    createCallRecorderMock.mockReturnValue(recorder);

    const { rerender } = renderHook(
      ({ status }: { status: CallStatus }) =>
        useCallRecording({ callId: 7, status }),
      { initialProps: { status: "connecting" as CallStatus } },
    );

    // connected 를 거치지 않고 바로 ended
    rerender({ status: "ended" });

    expect(recorder.finalize).not.toHaveBeenCalled();
  });
});
