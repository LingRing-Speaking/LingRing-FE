import { NativeWebRTC, isIosNative } from "@/lib/native/webrtcPlugin";
import { createRecording, requestRecordingPresignedUrl } from "@/domains/call/api/recording";

// BE 화이트리스트: audio/m4a, audio/mp4, audio/webm.
// iOS AVAssetWriter 의 .m4a 파일 기본 MIME 은 audio/mp4 가 더 정확.
const IOS_RECORDING_CONTENT_TYPE = "audio/mp4";

export interface UploadRecordingResult {
  recordingId: number;
}

// presign → S3 PUT → BE 통보(createRecording) 공통 골격. S3 PUT 동작만 플랫폼별로 주입한다.
// BE 계약(presign·createRecording)은 두 플랫폼이 동일하게 진화하므로 한 곳으로 모은다.
async function uploadViaPresign(
  callId: number,
  contentType: string,
  contentLength: number,
  putToS3: (url: string) => Promise<void>,
): Promise<UploadRecordingResult> {
  // 1) presigned URL 요청
  const { url, key } = await requestRecordingPresignedUrl(callId, {
    contentType,
    contentLength,
  });

  // 2) S3 직접 PUT (플랫폼별 주입)
  await putToS3(url);

  // 3) BE 에 완료 통보 (멱등 — 동일 callId/userId 재요청 시 같은 recordingId 반환)
  const { recordingId } = await createRecording(callId, { recordingKey: key });
  return { recordingId };
}

export interface UploadRecordingInput {
  callId: number;
  filePath: string;
  sizeBytes: number;
}

// iOS: native 파일을 native URLSession 으로 S3 에 PUT 하고, 성공 시 임시 파일 삭제.
// 통화 종료 후 / recoveryRun 에서 호출. 실패 시 throw → caller 가 파일 보존 결정.
export async function uploadRecording(input: UploadRecordingInput): Promise<UploadRecordingResult> {
  if (!isIosNative()) {
    throw new Error("[recordingUploader] uploadRecording 은 iOS 전용입니다");
  }

  const result = await uploadViaPresign(
    input.callId,
    IOS_RECORDING_CONTENT_TYPE,
    input.sizeBytes,
    async (url) => {
      await NativeWebRTC.uploadRecordingFile({
        filePath: input.filePath,
        url,
        contentType: IOS_RECORDING_CONTENT_TYPE,
      });
    },
  );

  // 업로드 성공 → 임시 파일 삭제. 삭제 실패는 무시 (다음 startup recovery 가 처리).
  try {
    await NativeWebRTC.deleteRecordingFile({ filePath: input.filePath });
  } catch (e) {
    console.warn("[recordingUploader] file delete failed, will retry next startup", e);
  }

  return result;
}

export interface UploadRecordingBlobInput {
  callId: number;
  blob: Blob;
}

// Android(web 경로): MediaRecorder 가 만든 Blob 을 fetch PUT 으로 S3 에 직접 올린다.
// content-type 은 codecs 파라미터를 떼어낸 base MIME(예: audio/webm)으로 보내 BE 화이트리스트와 맞춘다.
export async function uploadRecordingBlob(
  input: UploadRecordingBlobInput,
): Promise<UploadRecordingResult> {
  const contentType = (input.blob.type || "audio/webm").split(";")[0].trim();

  return uploadViaPresign(input.callId, contentType, input.blob.size, async (url) => {
    const res = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: input.blob,
    });
    if (!res.ok) {
      throw new Error(`[recordingUploader] S3 PUT 실패: ${res.status}`);
    }
  });
}
