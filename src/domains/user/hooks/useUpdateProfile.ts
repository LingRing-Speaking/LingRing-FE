import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { httpPutRaw } from "@/lib/http";
import { useAuthStore } from "@/domains/auth/store";
import type { User } from "@/domains/auth/types";
import {
  requestProfileImagePresignedUrl,
  updateProfile,
} from "../api/profileApi";

export interface UpdateProfileInput {
  nickname?: string;
  file?: File;
}

async function uploadImageAndGetKey(file: File): Promise<string> {
  const { uploadUrl, key } = await requestProfileImagePresignedUrl({
    contentType: file.type,
    contentLength: file.size,
  });
  await httpPutRaw(uploadUrl, file, file.type);
  return key;
}

async function runUpdateProfile({
  nickname,
  file,
}: UpdateProfileInput): Promise<User> {
  const profileImageKey = file ? await uploadImageAndGetKey(file) : undefined;
  if (!nickname && !profileImageKey) {
    throw new Error("변경할 항목이 없어요.");
  }
  return updateProfile({ nickname, profileImageKey });
}

export function useUpdateProfile(): UseMutationResult<
  User,
  Error,
  UpdateProfileInput
> {
  return useMutation({
    mutationFn: runUpdateProfile,
    onSuccess: (user) => {
      useAuthStore.getState().updateUser(user);
    },
  });
}
