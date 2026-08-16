import { Capacitor } from "@capacitor/core";
import { ApiError } from "@/lib/http";
import { NativeWebRTC } from "@/lib/native/webrtcPlugin";
import { uploadRecording } from "./recordingUploader";

// 인증이 확립된 뒤 호출된다 (앱 시작 후 세션 복원 / 로그인 직후 / 포그라운드 복귀).
// 이전 통화에서 업로드 못 끝낸 잔여 파일 발견 시 재시도.
// 실패 케이스 (앱 강제 종료 + 업로드 미완 / 네트워크 끊김 / BE 일시 장애 등).
// iOS(#84)·Android(#193) 모두 native 가 파일을 보존하므로 recovery 경로도 하나다.
//
// 정책:
// - 업로드 성공 → 파일 삭제 (recordingUploader 가 알아서)
// - 403 (CALL_PARTICIPANT_MISMATCH 등) → 파일 삭제. 이 기기·이 계정으로는 영영 올릴 수 없다.
// - 파일 깨짐 (size 0) → 삭제
// - 그 외 모든 실패 → 파일 보존 (다음 트리거에서 재시도)
//
// 401 을 삭제 사유에서 뺀 이유: 토큰이 아직 안 실린 요청·만료 직전 토큰처럼 재시도로 풀리는
// 상황이 섞여 있어 서버의 영구 거절로 볼 수 없다. 실제로 이 정책이 녹음을 유실시킨 적이 있다 —
// 인증 확립 전에 recovery 가 돌아 받은 401 을 영구 거절로 오판해 파일을 지웠다.
// 400 도 보존한다: BE 에러 응답에 code 필드가 없어(ApiResponse = data/status/message)
// CALL_ACTIVE(통화 종료가 아직 반영 안 됨 — 기다리면 풀림)와 형식·크기 오류를 구분할 수 없다.
// 녹음은 상대방의 학습 자산이므로 판단이 애매하면 남긴다.
const canNeverSucceed = (e: unknown) => e instanceof ApiError && e.status === 403;

// 인증 확립과 포그라운드 복귀가 연달아 오면 두 번 호출될 수 있다. 같은 파일을 두 번
// 업로드하지 않도록 실행 중이면 두 번째 호출은 그냥 돌아간다.
let running = false;

export async function recoveryRun(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  if (running) return;

  running = true;
  try {
    await retryPendingUploads();
  } finally {
    running = false;
  }
}

async function retryPendingUploads(): Promise<void> {
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
      await deleteFile(item.filePath);
      continue;
    }

    try {
      await uploadRecording({
        callId: item.callId,
        filePath: item.filePath,
        sizeBytes: item.sizeBytes,
      });
    } catch (e) {
      if (canNeverSucceed(e)) await deleteFile(item.filePath);

      const status = e instanceof ApiError ? e.status : undefined;
      console.warn("[recordingRecovery] upload failed", { callId: item.callId, status }, e);
    }
  }
}

async function deleteFile(filePath: string): Promise<void> {
  try {
    await NativeWebRTC.deleteRecordingFile({ filePath });
  } catch {
    // 삭제 실패 무시 — 다음 트리거에서 재시도
  }
}
