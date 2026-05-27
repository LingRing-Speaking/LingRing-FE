import { ApiError } from "@/lib/http";
import { NativeWebRTC, isIosNative } from "@/lib/native/webrtcPlugin";
import { uploadRecording } from "./recordingUploader";

// 앱 시작 시 1 회 호출. 이전 통화에서 업로드 못 끝낸 잔여 파일 발견 시 재시도.
// 실패 케이스 (앱 강제 종료 + 업로드 미완 / 네트워크 끊김 / BE 일시 장애 등).
//
// 정책:
// - 업로드 성공 → 파일 삭제 (recordingUploader 가 알아서)
// - 401 (BE 만료/권한) → 파일 삭제 (해당 통화의 다른 user 가 아니거나 만료된 키)
// - 403 (CALL_PARTICIPANT_MISMATCH 등) → 파일 삭제 (recovery 무의미)
// - 400 CALL_RECORDING_S3_MISSING → S3 에 없으므로 새로 PUT 재시도 가능. 단 본 흐름은 1회만
// - 네트워크 실패 / 5xx → 파일 보존 (다음 startup 재시도)
// - 파일 깨짐 (size 0) → 삭제 + sentry (다음 PR)
export async function recoveryRun(): Promise<void> {
  if (!isIosNative()) return;

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
      // 401/403 류면 파일 삭제, 그 외는 보존
      const isRecoveryImpossible =
        e instanceof ApiError && (e.status === 401 || e.status === 403);
      if (isRecoveryImpossible) {
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
