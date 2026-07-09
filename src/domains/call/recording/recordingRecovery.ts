import { Capacitor } from "@capacitor/core";
import { ApiError } from "@/lib/http";
import { NativeWebRTC, isIosNative } from "@/lib/native/webrtcPlugin";
import {
  deletePendingRecording,
  listPendingAndroidRecordings,
  readPendingRecording,
} from "./androidRecordingStore";
import { uploadRecording, uploadRecordingBlob } from "./recordingUploader";

// 앱 시작 시 1 회 호출. 이전 통화에서 업로드 못 끝낸 잔여 파일 발견 시 재시도.
// 실패 케이스 (앱 강제 종료 + 업로드 미완 / 네트워크 끊김 / BE 일시 장애 등).
//
// 정책 (iOS/Android 공통):
// - 업로드 성공 → 파일 삭제
// - 복구 불가능 에러 → 파일 삭제 (아래 status 목록)
// - 네트워크 실패 / 5xx → 파일 보존 (다음 startup 재시도)
// - 파일 깨짐 (size 0) → 삭제
//
// 플랫폼별 복구 불가능 status:
// - iOS: 401/403. (400 은 CALL_RECORDING_S3_MISSING 재시도 가능성 때문에 보존)
// - Android: 400/401/403. Android 의 400 은 만료(30일)로 간주해 삭제 — 로컬 날짜 로직 대체 (#187)
export async function recoveryRun(): Promise<void> {
  if (isIosNative()) return recoverIos();
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android") {
    return recoverAndroid();
  }
}

function isUnrecoverable(e: unknown, statuses: number[]): boolean {
  return e instanceof ApiError && statuses.includes(e.status);
}

async function recoverIos(): Promise<void> {
  let pending: Awaited<ReturnType<typeof NativeWebRTC.listPendingRecordings>>;
  try {
    pending = await NativeWebRTC.listPendingRecordings();
  } catch (e) {
    console.warn("[recordingRecovery] listPending failed", e);
    return;
  }

  for (const item of pending.items) {
    // 깨진/빈 파일 삭제
    if (item.sizeBytes <= 0) {
      try {
        await NativeWebRTC.deleteRecordingFile({ filePath: item.filePath });
      } catch {
        // 삭제 실패 무시 — 다음 startup 재시도
      }
      continue;
    }

    try {
      await uploadRecording({
        callId: item.callId,
        filePath: item.filePath,
        sizeBytes: item.sizeBytes,
      });
    } catch (e) {
      if (isUnrecoverable(e, [401, 403])) {
        try {
          await NativeWebRTC.deleteRecordingFile({ filePath: item.filePath });
        } catch {
          // 삭제 실패 무시 — 다음 startup 재시도
        }
      }
      const status = e instanceof ApiError ? e.status : undefined;
      console.warn("[recordingRecovery] upload failed", { callId: item.callId, status }, e);
    }
  }
}

async function recoverAndroid(): Promise<void> {
  const pending = await listPendingAndroidRecordings();

  for (const item of pending) {
    // 깨진/빈 파일 삭제
    if (item.sizeBytes <= 0) {
      try {
        await deletePendingRecording(item.path);
      } catch {
        // 삭제 실패 무시 — 다음 startup 재시도
      }
      continue;
    }

    try {
      const blob = await readPendingRecording(item.path, item.mimeType);
      await uploadRecordingBlob({ callId: item.callId, blob });
      await deletePendingRecording(item.path);
    } catch (e) {
      if (isUnrecoverable(e, [400, 401, 403])) {
        try {
          await deletePendingRecording(item.path);
        } catch {
          // 삭제 실패 무시 — 다음 startup 재시도
        }
      }
      const status = e instanceof ApiError ? e.status : undefined;
      console.warn("[recordingRecovery] upload failed", { callId: item.callId, status }, e);
    }
  }
}
