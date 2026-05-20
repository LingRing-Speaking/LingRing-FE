import { NativeWebRTC, isIosNative } from "@/lib/native/webrtcPlugin";
import {
  createRecording,
  requestRecordingPresignedUrl,
} from "@/domains/call/api/recording";

// BE 화이트리스트: audio/m4a, audio/mp4, audio/webm.
// iOS AVAssetWriter 의 .m4a 파일 기본 MIME 은 audio/mp4 가 더 정확.
const RECORDING_CONTENT_TYPE = "audio/mp4";

export interface UploadRecordingInput {
  callId: number;
  filePath: string;
  sizeBytes: number;
}

export interface UploadRecordingResult {
  recordingId: number;
}

// 통화 종료 후 호출. presign → S3 PUT → BE 통보 → 임시 파일 삭제.
// 에러 발생 시 throw — caller (useCallRecording cleanup / recoveryRun) 가 임시 파일 보존 결정.
export async function uploadRecording(
  input: UploadRecordingInput,
): Promise<UploadRecordingResult> {
  if (!isIosNative()) {
    throw new Error("[recordingUploader] iOS only");
  }

  // 1) presigned URL 요청
  const { url, key } = await requestRecordingPresignedUrl(input.callId, {
    contentType: RECORDING_CONTENT_TYPE,
    contentLength: input.sizeBytes,
  });

  // 2) S3 직접 PUT (native URLSession stream)
  await NativeWebRTC.uploadRecordingFile({
    filePath: input.filePath,
    url,
    contentType: RECORDING_CONTENT_TYPE,
  });

  // 3) BE 에 완료 통보 (멱등 — 동일 callId/userId 재요청 시 같은 recordingId 반환)
  const { recordingId } = await createRecording(input.callId, {
    recordingKey: key,
  });

  // 4) 업로드 성공 → 임시 파일 삭제. 삭제 실패는 무시 (다음 startup recovery 가 처리)
  try {
    await NativeWebRTC.deleteRecordingFile({ filePath: input.filePath });
  } catch (e) {
    console.warn("[recordingUploader] file delete failed, will retry next startup", e);
  }

  return { recordingId };
}
