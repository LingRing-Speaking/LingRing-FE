import { useEffect, useRef } from "react";
import { NativeWebRTC, isIosNative } from "@/lib/native/webrtcPlugin";
import { uploadRecording } from "./recordingUploader";

import type { CallStatus } from "@/domains/call/hooks/useCallSession";

interface UseCallRecordingOptions {
  callId: number | null;
  status: CallStatus;
}

// 통화 상태에 반응해 녹음을 시작/정지하고, cleanup 시 업로드를 fire-and-forget 으로 트리거.
// useCallSession 과 독립. CallPage 가 두 hook 을 조합.
//
// 정책 (spec §7):
// - 통화 connected 진입 시 녹음 시작 (callId 도 그 시점에 알고 있음)
// - end (status === "ended" or unmount) 시 녹음 stop → 업로드는 fire-and-forget
// - 업로드 도중 컴포넌트 unmount 되어도 module-level Promise 가 끝까지 실행
// - 업로드 실패 시 파일 보존 (recoveryRun 이 다음 startup 에서 재시도)
export function useCallRecording({ callId, status }: UseCallRecordingOptions): void {
  // 녹음 시작 여부 (중복 시작 방지)
  const startedRef = useRef(false);
  // 녹음 중인 callId (cleanup 에서 사용)
  const callIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isIosNative()) return;
    if (callId == null) return;
    if (status !== "connected") return;
    if (startedRef.current) return;

    startedRef.current = true;
    callIdRef.current = callId;

    NativeWebRTC.startFileRecording({ callId }).catch((e) => {
      console.warn("[useCallRecording] startFileRecording failed", e);
      startedRef.current = false;
      callIdRef.current = null;
    });
  }, [callId, status]);

  useEffect(() => {
    return () => {
      if (!isIosNative()) return;
      if (!startedRef.current) return;
      const currentCallId = callIdRef.current;
      startedRef.current = false;
      callIdRef.current = null;

      void finalizeAndUpload(currentCallId);
    };
  }, []);
}

// 모듈 레벨로 분리: hook unmount 후에도 Promise 가 끝까지 실행되도록.
async function finalizeAndUpload(callId: number | null): Promise<void> {
  if (callId == null) return;

  let stopped:
    | Awaited<ReturnType<typeof NativeWebRTC.stopFileRecording>>
    | undefined;
  try {
    stopped = await NativeWebRTC.stopFileRecording();
  } catch (e) {
    console.warn("[useCallRecording] stopFileRecording failed", e);
    return;
  }

  if (!stopped?.filePath || !stopped.sizeBytes) {
    return;
  }

  try {
    await uploadRecording({
      callId,
      filePath: stopped.filePath,
      sizeBytes: stopped.sizeBytes,
    });
  } catch (e) {
    // 실패는 보존 — 다음 앱 시작 시 recoveryRun 가 재시도
    console.warn("[useCallRecording] upload failed, will retry next startup", e);
  }
}
