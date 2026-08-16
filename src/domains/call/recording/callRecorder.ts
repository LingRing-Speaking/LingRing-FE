import { Capacitor } from "@capacitor/core";
import { ApiError } from "@/lib/http";
import { NativeWebRTC } from "@/lib/native/webrtcPlugin";
import { captureException } from "@/lib/sentry";
import { uploadRecording, type UploadRecordingInput } from "./recordingUploader";

// 통화 녹음. 녹음 대상은 양 플랫폼 모두 "학습자 본인의 마이크 음성".
// iOS(#84)·Android(#193) 모두 native ADM 이 통화 음성을 m4a 파일로 녹음하므로
// recorder 는 native 경로 하나다 — 웹(dev)은 녹음 비활성(null).
//
// start() 는 통화 connected 시점, finalize() 는 통화 종료 시점에 호출된다.
// finalize() 는 hook unmount 후에도 끝까지 실행되도록 fire-and-forget 으로 호출된다.
export interface CallRecorder {
  start(callId: number): Promise<void>;
  finalize(callId: number): Promise<void>;
}

// 통화 종료 직후의 업로드는 서버가 통화를 아직 "진행 중"으로 보고 있어 400 으로 거절된다.
// BE 는 HANGUP 수신 시 즉시, WS 끊김은 disconnect 유예(10초) 뒤에 통화를 종료 처리하므로
// (SignalingFacade.handleDisconnect), 유예를 넘기도록 두 번 더 시도해 통화 직후 그 자리에서
// 업로드를 끝낸다. 여기서 다 실패해도 파일은 남고 recoveryRun 이 다음 기회에 재시도한다.
const UPLOAD_RETRY_DELAYS_MS = [3_000, 9_000];

// 401·403 은 기다린다고 풀리지 않는다 — 재시도 없이 caller 로 던져 파일 보존 판단에 맡긴다.
const isWorthRetrying = (e: unknown) =>
  !(e instanceof ApiError && (e.status === 401 || e.status === 403));

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function uploadWithRetry(input: UploadRecordingInput): Promise<void> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      await uploadRecording(input);
      return;
    } catch (e) {
      const hasRetryLeft = attempt < UPLOAD_RETRY_DELAYS_MS.length;
      if (!hasRetryLeft || !isWorthRetrying(e)) throw e;

      console.warn(
        `[callRecorder] upload failed, retrying in ${UPLOAD_RETRY_DELAYS_MS[attempt]}ms`,
        e,
      );
      await delay(UPLOAD_RETRY_DELAYS_MS[attempt]);
    }
  }
}

function createNativeCallRecorder(): CallRecorder {
  return {
    async start(callId) {
      await NativeWebRTC.startFileRecording({ callId });
    },
    async finalize(callId) {
      let stopped;
      try {
        stopped = await NativeWebRTC.stopFileRecording();
      } catch (e) {
        // 녹음은 상대방의 학습 자산 — 조용한 유실은 허용되지 않으므로 보고한다.
        console.warn("[callRecorder] stopFileRecording failed", e);
        captureException(e, {
          tags: { source: "recording-stop" },
          extra: { callId },
        });
        return;
      }
      if (!stopped?.filePath || !stopped.sizeBytes) return;

      try {
        await uploadWithRetry({
          callId,
          filePath: stopped.filePath,
          sizeBytes: stopped.sizeBytes,
        });
      } catch (e) {
        // 실패 시 파일 보존 — recoveryRun 이 다음 인증 확립·포그라운드 복귀에 재시도.
        console.warn("[callRecorder] upload failed, will retry on next recovery", e);
        captureException(e, {
          tags: { source: "recording-upload" },
          extra: { callId },
        });
      }
    },
  };
}

// 플랫폼에 맞는 recorder 를 만든다. 녹음 미지원 환경(웹 dev)은 null 을 반환해 녹음을 끈다.
export function createCallRecorder(): CallRecorder | null {
  if (Capacitor.isNativePlatform()) return createNativeCallRecorder();
  return null;
}
