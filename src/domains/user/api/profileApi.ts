import { httpPatch, httpPost } from "@/lib/http";
import type { User } from "@/domains/auth/types";

export interface PresignedUrlResponse {
  uploadUrl: string;
  key: string;
}

export interface PresignedUrlRequest {
  contentType: string;
  contentLength: number;
}

export interface UpdateProfileRequest {
  nickname?: string;
  profileImageKey?: string;
}

export const requestProfileImagePresignedUrl = (
  body: PresignedUrlRequest,
): Promise<PresignedUrlResponse> =>
  httpPost<PresignedUrlResponse>("/me/profile/image/presigned-url", body);

export const updateProfile = (body: UpdateProfileRequest): Promise<User> =>
  httpPatch<User>("/me/profile", body);
