import { useCallback, useEffect, useRef } from "react";
import type { CallStatus } from "@/domains/call/hooks/useCallSession";
import { createCallRecorder, type CallRecorder } from "./callRecorder";

interface UseCallRecordingOptions {
  callId: number | null;
  status: CallStatus;
  // Android(web 경로) 녹음이 로컬 마이크 스트림을 가져오기 위한 getter. iOS 는 불필요.
  getLocalStream?: () => MediaStream | null;
}

// 통화 상태에 반응해 녹음을 시작/정지하고, 종료 시 업로드를 fire-and-forget 으로 트리거.
// 플랫폼 분기는 createCallRecorder 팩토리 한 곳에만 존재한다 (iOS native / Android MediaRecorder).
// useCallSession 과 독립. CallPage 가 두 hook 을 조합.
//
// 정책 (spec §7, #186):
// - 통화 connected 진입 시 녹음 시작 (callId 도 그 시점에 알고 있음)
// - 통화 종료(status === "ended" | "error") 시점에 즉시 녹음 stop → 업로드.
//   화면 이탈(unmount)을 기다리지 않으므로, 종료 화면에서 앱을 닫아도 업로드가 이미 시작돼 있다.
// - unmount 는 종료 상태를 거치지 않고 이탈한 경우(통화 중 이탈)를 위한 안전망.
// - finalize 는 중복 방지 가드로 통화당 한 번만 실행된다.
// - 업로드 도중 컴포넌트 unmount 되어도 recorder 객체가 Promise 끝까지 살아있음
// - iOS 업로드 실패 시 파일 보존 (recoveryRun 이 다음 startup 에서 재시도)
export function useCallRecording({
  callId,
  status,
  getLocalStream,
}: UseCallRecordingOptions): void {
  const recorderRef = useRef<CallRecorder | null>(null);
  const startedRef = useRef(false);
  const callIdRef = useRef<number | null>(null);
  // 최신 getLocalStream 을 effect 가 의존성 없이 읽도록 ref 로 보관.
  const getStreamRef = useRef(getLocalStream);
  getStreamRef.current = getLocalStream;

  // 시작된 녹음을 한 번만 정지·업로드한다. 종료 상태 진입과 unmount 안전망이 함께 호출해도 안전.
  const finalize = useCallback(() => {
    if (!startedRef.current) return;
    const currentCallId = callIdRef.current;
    const recorder = recorderRef.current;
    startedRef.current = false;
    callIdRef.current = null;
    recorderRef.current = null;

    if (recorder && currentCallId != null) void recorder.finalize(currentCallId);
  }, []);

  useEffect(() => {
    if (callId == null) return;
    if (status !== "connected") return;
    if (startedRef.current) return;

    const recorder = createCallRecorder(() => getStreamRef.current?.() ?? null);
    if (!recorder) return;

    startedRef.current = true;
    callIdRef.current = callId;
    recorderRef.current = recorder;

    recorder.start(callId).catch((e) => {
      console.warn("[useCallRecording] start failed", e);
      startedRef.current = false;
      callIdRef.current = null;
      recorderRef.current = null;
    });
  }, [callId, status]);

  // 통화 종료 시점에 즉시 finalize (화면 이탈 대기 없음).
  useEffect(() => {
    if (status === "ended" || status === "error") finalize();
  }, [status, finalize]);

  // 종료 상태를 거치지 않고 이탈한 경우(통화 중 unmount)를 위한 안전망.
  useEffect(() => {
    return () => finalize();
  }, [finalize]);
}
