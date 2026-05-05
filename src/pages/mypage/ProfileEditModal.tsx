import { useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/http";
import { useUpdateProfile } from "@/domains/user/hooks/useUpdateProfile";

const MAX_BYTES = 30 * 1024 * 1024;
const MAX_MB_LABEL = 30;
const MIN_NICKNAME = 2;
const MAX_NICKNAME = 15;
const FALLBACK_ERROR = "저장에 실패했어요. 다시 시도해주세요.";

interface ProfileEditModalProps {
  open: boolean;
  currentNickname: string;
  currentProfileImage: string | null;
  onClose: () => void;
}

type FieldError = string | null;

function validateNickname(value: string): FieldError {
  const trimmed = value.trim();
  if (trimmed.length === 0) return "닉네임을 입력해주세요.";
  if (trimmed.length < MIN_NICKNAME || trimmed.length > MAX_NICKNAME) {
    return `닉네임은 ${MIN_NICKNAME}~${MAX_NICKNAME}자여야 해요.`;
  }
  return null;
}

function validateImageFile(file: File): FieldError {
  if (!file.type.startsWith("image/")) return "이미지 파일만 선택해주세요.";
  if (file.size > MAX_BYTES) return `${MAX_MB_LABEL}MB 이하 이미지만 업로드할 수 있어요.`;
  return null;
}

function mapServerError(err: unknown): string {
  if (!(err instanceof ApiError)) return FALLBACK_ERROR;
  if (err.status === 409) return "이미 사용 중인 닉네임이에요.";
  if (err.status === 400) return err.message || FALLBACK_ERROR;
  return FALLBACK_ERROR;
}

export function ProfileEditModal({
  open,
  currentNickname,
  currentProfileImage,
  onClose,
}: ProfileEditModalProps) {
  const [nickname, setNickname] = useState(currentNickname);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileError, setFileError] = useState<FieldError>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const updateProfile = useUpdateProfile();
  const { reset } = updateProfile;

  useEffect(() => {
    if (!open) return;
    setNickname(currentNickname);
    setFile(null);
    setPreviewUrl(null);
    setFileError(null);
    setSubmitError(null);
    reset();
  }, [open, currentNickname, reset]);

  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const nicknameError = validateNickname(nickname);
  const nicknameChanged = nickname.trim() !== currentNickname;
  const nicknameToSubmit = nicknameChanged && !nicknameError ? nickname.trim() : undefined;
  const fileToSubmit = file && !fileError ? file : undefined;
  const canSubmit = Boolean(nicknameToSubmit || fileToSubmit) && !updateProfile.isPending;

  const handlePickFile = () => fileInputRef.current?.click();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!picked) return;
    const error = validateImageFile(picked);
    setFileError(error);
    setFile(error ? null : picked);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(error ? null : URL.createObjectURL(picked));
    setSubmitError(null);
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitError(null);
    try {
      await updateProfile.mutateAsync({
        nickname: nicknameToSubmit,
        file: fileToSubmit,
      });
      onClose();
    } catch (err) {
      setSubmitError(mapServerError(err));
    }
  };

  const previewSrc = previewUrl ?? currentProfileImage;
  const initial = currentNickname.charAt(0);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-edit-title"
      className="absolute inset-0 z-20 flex items-center justify-center px-6"
    >
      <button
        type="button"
        aria-label="프로필 편집 닫기"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />
      <div className="relative w-full max-w-[320px] rounded-[20px] bg-white p-6 shadow-ctrl">
        <h3
          id="profile-edit-title"
          className="text-center text-[17px] font-bold leading-tight tracking-tight text-gray-900"
        >
          프로필 편집
        </h3>

        <div className="mt-5 flex flex-col items-center gap-2">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-mint-400 via-mint-500 to-coral-500">
            {previewSrc ? (
              <img
                src={previewSrc}
                alt="프로필 미리보기"
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-[32px] font-bold leading-none tracking-tight text-white">
                {initial}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={handlePickFile}
            disabled={updateProfile.isPending}
            className="rounded-full bg-gray-100 px-3.5 py-1.5 text-[13px] font-semibold text-gray-700 active:bg-gray-200 disabled:opacity-50"
          >
            이미지 변경
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            aria-label="프로필 이미지 선택"
            onChange={handleFileChange}
            className="hidden"
          />
          {fileError && (
            <p role="alert" className="text-[12.5px] font-medium text-coral-600">
              {fileError}
            </p>
          )}
        </div>

        <div className="mt-5">
          <label
            htmlFor="nickname-input"
            className="mb-1.5 block text-[13px] font-medium text-gray-700"
          >
            닉네임
          </label>
          <input
            id="nickname-input"
            type="text"
            value={nickname}
            onChange={(e) => {
              setNickname(e.target.value);
              setSubmitError(null);
            }}
            disabled={updateProfile.isPending}
            maxLength={MAX_NICKNAME}
            className="w-full rounded-[12px] border border-gray-200 px-3.5 py-2.5 text-[15px] tracking-tight text-gray-900 outline-none focus:border-mint-500 disabled:bg-gray-50"
          />
          {nicknameError && nicknameChanged && (
            <p role="alert" className="mt-1.5 text-[12.5px] font-medium text-coral-600">
              {nicknameError}
            </p>
          )}
        </div>

        {submitError && (
          <p role="alert" className="mt-3 text-center text-[13px] font-medium text-coral-600">
            {submitError}
          </p>
        )}

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={updateProfile.isPending}
            className="flex-1 rounded-[14px] bg-gray-100 py-3.5 text-[15px] font-bold tracking-tight text-gray-800 transition-transform active:scale-[0.98] disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex-1 rounded-[14px] bg-mint-500 py-3.5 text-[15px] font-bold tracking-tight text-white transition-transform active:scale-[0.98] disabled:opacity-50"
          >
            {updateProfile.isPending ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
