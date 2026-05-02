import { useEffect } from "react";
import { useUserProfile } from "@/domains/user/hooks/useUserProfile";
import type { Level } from "@/domains/user/types";

const LEVEL_LABEL: Record<Level, string> = {
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
};

const MAX_TEMPERATURE = 99;

type Props = {
  partnerId: number | null;
  open: boolean;
  onClose: () => void;
};

export function PartnerProfileModal({ partnerId, open, onClose }: Props) {
  const profile = useUserProfile(open ? partnerId : null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 z-10 bg-black/45"
      />
      <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center px-6">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="partner-profile-name"
          className="pointer-events-auto relative w-full max-w-[320px] rounded-[22px] bg-white p-6 pb-[22px] shadow-[0_20px_50px_rgba(0,0,0,0.25)]"
        >
          <button
            type="button"
            aria-label="닫기"
            onClick={onClose}
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-gray-500 active:bg-gray-100"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-[18px] w-[18px]"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          {profile.isPending && <ProfileSkeleton />}
          {profile.isError && <ProfileError onRetry={() => profile.refetch()} />}
          {profile.data && <ProfileBody profile={profile.data} />}
        </div>
      </div>
    </>
  );
}

function ProfileBody({
  profile,
}: {
  profile: { id: number; nickname: string; level: Level; mannerTemperature: number };
}) {
  const initial = profile.nickname.charAt(0);
  const fillWidth = `${(profile.mannerTemperature / MAX_TEMPERATURE) * 100}%`;

  return (
    <>
      <div className="mb-[18px] mt-1 flex flex-col items-center gap-2.5">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-mint-400 via-mint-500 to-coral-500">
          <span className="text-[32px] font-bold leading-none tracking-tight text-white">
            {initial}
          </span>
        </div>
        <h2
          id="partner-profile-name"
          className="m-0 mt-1 text-[20px] font-bold leading-tight tracking-tight text-gray-900"
        >
          {profile.nickname}
        </h2>
        <span className="inline-flex items-center rounded-full bg-mint-100 px-2.5 py-1 text-[12px] font-bold leading-none tracking-tight text-mint-600">
          {LEVEL_LABEL[profile.level]}
        </span>
      </div>

      <div className="mb-3 rounded-[14px] bg-gray-50 px-4 py-3.5">
        <div className="mb-2.5 flex items-center justify-between">
          <span className="text-[13px] font-medium leading-none tracking-tight text-gray-600">
            매너온도
          </span>
          <span className="text-[15px] font-bold leading-none tracking-tight text-gray-900 tabular-nums">
            {profile.mannerTemperature.toFixed(1)}°C
          </span>
        </div>
        <div
          role="img"
          aria-label={`매너온도 ${profile.mannerTemperature.toFixed(1)}도`}
          className="relative h-[7px] overflow-visible rounded-full bg-gray-200"
        >
          <div
            data-testid="partner-temp-fill"
            className="relative h-full rounded-full bg-gradient-to-r from-mint-400 via-mint-500 to-coral-500"
            style={{ width: fillWidth }}
          >
            <span className="absolute -right-[6px] top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-white shadow-[0_0_0_2px_#1FBF92,0_2px_5px_rgba(0,0,0,0.12)]" />
          </div>
        </div>
      </div>
    </>
  );
}

function ProfileSkeleton() {
  return (
    <div className="flex flex-col items-center gap-3 py-6">
      <div className="h-20 w-20 animate-pulse rounded-full bg-gray-100" />
      <div className="h-5 w-32 animate-pulse rounded bg-gray-100" />
      <div className="h-4 w-20 animate-pulse rounded bg-gray-100" />
    </div>
  );
}

function ProfileError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-6">
      <p className="m-0 text-[14px] font-medium text-gray-700">
        프로필을 불러오지 못했어요.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-md bg-mint-500 px-4 py-2 text-[13px] font-bold text-white"
      >
        다시 시도
      </button>
    </div>
  );
}
