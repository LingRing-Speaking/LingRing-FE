import { Capacitor } from "@capacitor/core";
import { NativeWebRTC } from "@/lib/native/webrtcPlugin";
import { uploadRecording } from "./recordingUploader";

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
        console.warn("[callRecorder] stopFileRecording failed", e);
        return;
      }
      if (!stopped?.filePath || !stopped.sizeBytes) return;

      try {
        await uploadRecording({
          callId,
          filePath: stopped.filePath,
          sizeBytes: stopped.sizeBytes,
        });
      } catch (e) {
        // 실패 시 파일 보존 — 다음 앱 시작 시 recoveryRun 이 재시도.
        console.warn("[callRecorder] upload failed, will retry next startup", e);
      }
    },
  };
}

// 플랫폼에 맞는 recorder 를 만든다. 녹음 미지원 환경(웹 dev)은 null 을 반환해 녹음을 끈다.
export function createCallRecorder(): CallRecorder | null {
  if (Capacitor.isNativePlatform()) return createNativeCallRecorder();
  return null;
}
