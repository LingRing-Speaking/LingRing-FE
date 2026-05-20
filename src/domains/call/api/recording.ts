import { httpPost } from "@/lib/http";

// BE Notion spec: 🎙️ [Spec] 통화 녹음 업로드 API (id 36633d3a-895c-8187-904a-d24a28c183be)

export interface RecordingPresignedUrlRequest {
  contentType: string;
  contentLength: number;
}

export interface RecordingPresignedUrlResponse {
  url: string;
  key: string;
}

export interface RecordingCreateRequest {
  recordingKey: string;
}

export type RecordingStatus = "UPLOADED";

export interface RecordingCreateResponse {
  recordingId: number;
  status: RecordingStatus;
}

export const requestRecordingPresignedUrl = (
  callId: number,
  body: RecordingPresignedUrlRequest,
): Promise<RecordingPresignedUrlResponse> =>
  httpPost<RecordingPresignedUrlResponse>(
    `/calls/${callId}/recordings/presigned-url`,
    body,
  );

export const createRecording = (
  callId: number,
  body: RecordingCreateRequest,
): Promise<RecordingCreateResponse> =>
  httpPost<RecordingCreateResponse>(`/calls/${callId}/recordings`, body);
