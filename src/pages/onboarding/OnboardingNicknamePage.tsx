import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageShell } from "@/components/PageShell";
import { ApiError } from "@/lib/http";
import { MAX_NICKNAME_LENGTH, validateNickname } from "@/domains/user/nickname";
import { useUpdateProfile } from "@/domains/user/hooks/useUpdateProfile";

const FALLBACK_ERROR = "잠시 후 다시 시도해주세요.";

// PATCH /me/profile 의 서버 에러를 사용자 카피로 변환. (ProfileEditModal 과 동일한 매핑이지만
// 온보딩과 마이페이지 편집은 카피가 갈릴 수 있어 각자 지역 함수로 둔다.)
function mapServerError(err: unknown): string {
  if (!(err instanceof ApiError)) return FALLBACK_ERROR;
  if (err.status === 409) return "이미 사용 중인 닉네임이에요.";
  if (err.status === 400) return err.message || FALLBACK_ERROR;
  return FALLBACK_ERROR;
}

export function OnboardingNicknamePage() {
  const navigate = useNavigate();
  const updateProfile = useUpdateProfile();
  const [nickname, setNickname] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);

  const check = validateNickname(nickname);
  const isDirty = nickname.trim().length > 0;
  const canSubmit = check.ok && !updateProfile.isPending;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!check.ok || updateProfile.isPending) return;
    setSubmitError(null);
    try {
      await updateProfile.mutateAsync({ nickname: check.value });
      navigate("/home", { replace: true });
    } catch (err) {
      setSubmitError(mapServerError(err));
    }
  };

  return (
    <PageShell>
      <main className="relative flex flex-1 flex-col bg-gray-50">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="onboarding-nickname-title"
          className="absolute inset-0 z-20 flex items-center justify-center px-6"
        >
          <div aria-hidden="true" className="absolute inset-0 bg-black/40" />
          <form
            onSubmit={handleSubmit}
            className="relative w-full max-w-[320px] rounded-[20px] bg-white p-6 shadow-ctrl"
          >
            <h1
              id="onboarding-nickname-title"
              className="text-center text-[17px] font-bold leading-tight tracking-tight text-gray-900"
            >
              닉네임을 정해주세요
            </h1>
            <p className="mt-2 text-center text-[13.5px] font-medium leading-relaxed tracking-tight text-gray-500">
              통화 상대에게 보여질 이름이에요.
              <br />
              언제든 마이페이지에서 바꿀 수 있어요.
            </p>

            <div className="mt-5">
              <label
                htmlFor="onboarding-nickname-input"
                className="mb-1.5 block text-[13px] font-medium text-gray-700"
              >
                닉네임
              </label>
              <input
                id="onboarding-nickname-input"
                type="text"
                aria-label="닉네임"
                value={nickname}
                onChange={(e) => {
                  setNickname(e.target.value);
                  setSubmitError(null);
                }}
                disabled={updateProfile.isPending}
                maxLength={MAX_NICKNAME_LENGTH}
                autoFocus
                placeholder="2~12자로 입력해주세요"
                className="w-full rounded-[12px] border border-gray-200 px-3.5 py-2.5 text-[15px] tracking-tight text-gray-900 outline-none focus:border-mint-500 disabled:bg-gray-50"
              />
              {!check.ok && isDirty && (
                <p role="alert" className="mt-1.5 text-[12.5px] font-medium text-coral-600">
                  {check.reason}
                </p>
              )}
            </div>

            {submitError && (
              <p role="alert" className="mt-3 text-center text-[13px] font-medium text-coral-600">
                {submitError}
              </p>
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              className="mt-5 w-full rounded-[14px] bg-mint-500 py-3.5 text-[15px] font-bold tracking-tight text-white transition-transform active:scale-[0.98] disabled:bg-gray-200 disabled:text-gray-400"
            >
              {updateProfile.isPending ? "저장 중..." : "시작하기"}
            </button>
          </form>
        </div>
      </main>
    </PageShell>
  );
}
