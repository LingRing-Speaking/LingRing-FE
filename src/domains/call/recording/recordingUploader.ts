import { Capacitor } from "@capacitor/core";
import { NativeWebRTC } from "@/lib/native/webrtcPlugin";
import { createRecording, requestRecordingPresignedUrl } from "@/domains/call/api/recording";

// BE 화이트리스트: audio/m4a, audio/mp4, audio/webm.
// iOS AVAssetWriter·Android MediaMuxer 의 .m4a 파일 MIME 은 audio/mp4 가 정확 (#193 Phase 3).
const RECORDING_CONTENT_TYPE = "audio/mp4";

export interface UploadRecordingResult {
  recordingId: number;
}

export interface UploadRecordingInput {
  callId: number;
  filePath: string;
  sizeBytes: number;
}

// native 파일을 native HTTP(URLSession/HttpURLConnection)로 S3 에 PUT — WebView 를 타지
// 않으므로 CORS 무관. 통화 종료 후 / recoveryRun 에서 호출. 실패 시 throw → caller 가
// 파일 보존 결정. 성공 시 임시 파일 삭제.
export async function uploadRecording(input: UploadRecordingInput): Promise<UploadRecordingResult> {
  if (!Capacitor.isNativePlatform()) {
    throw new Error("[recordingUploader] uploadRecording 은 네이티브 전용입니다");
  }

  // 1) presigned URL 요청
  const { url, key } = await requestRecordingPresignedUrl(input.callId, {
    contentType: RECORDING_CONTENT_TYPE,
    contentLength: input.sizeBytes,
  });

  // 2) S3 직접 PUT (native)
  await NativeWebRTC.uploadRecordingFile({
    filePath: input.filePath,
    url,
    contentType: RECORDING_CONTENT_TYPE,
  });

  // 3) BE 에 완료 통보 (멱등 — 동일 callId/userId 재요청 시 같은 recordingId 반환)
  const { recordingId } = await createRecording(input.callId, { recordingKey: key });

  // 업로드 성공 → 임시 파일 삭제. 삭제 실패는 무시 (다음 startup recovery 가 처리).
  try {
    await NativeWebRTC.deleteRecordingFile({ filePath: input.filePath });
  } catch (e) {
    console.warn("[recordingUploader] file delete failed, will retry next startup", e);
  }

  return { recordingId };
}
