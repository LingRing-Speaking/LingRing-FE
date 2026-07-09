import { Capacitor } from "@capacitor/core";
import { NativeWebRTC, isIosNative } from "@/lib/native/webrtcPlugin";
import {
  createAndroidRecordingStore,
  type AndroidRecordingStore,
} from "./androidRecordingStore";
import { uploadRecording, uploadRecordingBlob } from "./recordingUploader";

// 통화 녹음의 플랫폼 추상화. 녹음 대상은 양 플랫폼 모두 "학습자 본인의 마이크 음성".
// - iOS: native ADM 이 통화 음성을 .m4a 파일로 녹음 (WebRTCPlugin).
// - Android(web 경로): 로컬 마이크 MediaStream 을 MediaRecorder 로 webm/opus 녹음.
//
// start() 는 통화 connected 시점, finalize() 는 통화 종료 시점에 호출된다.
// finalize() 는 hook unmount 후에도 끝까지 실행되도록 fire-and-forget 으로 호출된다.
export interface CallRecorder {
  start(callId: number): Promise<void>;
  finalize(callId: number): Promise<void>;
}

// MediaRecorder 가 지원하는 첫 mimeType 선택. BE 화이트리스트(webm)와 호환되는 순서.
const PREFERRED_MIME_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
// 통화 중 주기적으로 chunk 를 받아 메모리에 축적 (마지막 flush 유실 구간 최소화).
const TIMESLICE_MS = 1000;
// finalize 시 onstop(최종 dataavailable 이후) 대기 안전망.
const FLUSH_TIMEOUT_MS = 2000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return PREFERRED_MIME_TYPES.find((t) => MediaRecorder.isTypeSupported(t));
}

function createIosCallRecorder(): CallRecorder {
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

function createWebCallRecorder(getStream: () => MediaStream | null): CallRecorder {
  let recorder: MediaRecorder | null = null;
  let stoppedPromise: Promise<void> | null = null;
  let store: AndroidRecordingStore | null = null;
  const chunks: Blob[] = [];

  return {
    async start(callId) {
      const stream = getStream();
      if (!stream) {
        console.warn("[callRecorder] 로컬 스트림이 없어 녹음을 생략합니다");
        return;
      }
      const mimeType = pickMimeType();
      if (!mimeType) {
        console.warn("[callRecorder] MediaRecorder 미지원 — 녹음을 생략합니다");
        return;
      }

      // 디스크 백업 (#187): 업로드 전에 앱이 죽어도 다음 시작 recovery 로 살릴 수 있게
      // chunk 를 앱 저장소에도 이어 쓴다. 메모리 chunks 가 본선이고 store 실패는 무시된다.
      // 클로저로 캡처해 finalize 의 stop() 이 흘려보내는 마지막 chunk 까지 백업된다.
      const backupStore = createAndroidRecordingStore(callId, mimeType);
      store = backupStore;

      const rec = new MediaRecorder(stream, { mimeType });
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
          void backupStore.append(e.data);
        }
      };
      // onstop 은 최종 dataavailable 이후 발생 → 이 시점에 chunks 가 완전.
      // 통화 종료로 트랙이 먼저 끝나 자동 stop 되는 경우도 동일하게 resolve 된다.
      stoppedPromise = new Promise<void>((resolve) => {
        rec.onstop = () => resolve();
      });
      rec.start(TIMESLICE_MS);
      recorder = rec;
    },

    async finalize(callId) {
      const rec = recorder;
      const stopped = stoppedPromise;
      const backup = store;
      recorder = null;
      stoppedPromise = null;
      store = null;
      if (!rec) return;

      const mimeType = rec.mimeType || "audio/webm";
      if (rec.state !== "inactive") {
        try {
          rec.stop();
        } catch {
          // 이미 정지된 경우 등 — 아래 대기에서 처리
        }
      }
      if (stopped) {
        await Promise.race([stopped, delay(FLUSH_TIMEOUT_MS)]);
      }

      const blob = new Blob(chunks, { type: mimeType });
      chunks.length = 0;
      if (blob.size === 0) {
        // 올릴 것이 없으면 잔존 백업 파일만 정리
        await backup?.remove();
        return;
      }

      try {
        await uploadRecordingBlob({ callId, blob });
        // 업로드 성공 → 백업 파일 삭제. 실패 시 보존해 다음 앱 시작 recovery 가 재시도.
        await backup?.remove();
      } catch (e) {
        console.warn("[callRecorder] blob upload failed, will retry next startup", e);
      }
    },
  };
}

// 플랫폼에 맞는 recorder 를 만든다. 녹음 미지원 환경(웹 dev 등)은 null 을 반환해 녹음을 끈다.
export function createCallRecorder(getStream: () => MediaStream | null): CallRecorder | null {
  if (isIosNative()) return createIosCallRecorder();
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android") {
    return createWebCallRecorder(getStream);
  }
  return null;
}
