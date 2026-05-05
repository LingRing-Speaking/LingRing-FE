import { useState } from "react";
import type { Level } from "@/domains/user/types";
import { ProfileEditModal } from "./ProfileEditModal";

const LEVEL_LABEL: Record<Level, string> = {
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
};

const MAX_TEMPERATURE = 99;
const DEFAULT_TEMPERATURE_DESCRIPTION = "평소에 친절한 대화를 하고 있어요";

type Props = {
  name: string;
  profileImage: string | null;
  level: Level;
  mannerTemperature: number;
};

export function ProfileCard({ name, profileImage, level, mannerTemperature }: Props) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const initial = name.charAt(0);
  const levelLabel = LEVEL_LABEL[level];
  const fillWidth = `${(mannerTemperature / MAX_TEMPERATURE) * 100}%`;

  return (
    <section className="mb-4 rounded-[18px] bg-white p-5 shadow-card">
      <div className="relative flex items-center gap-3.5">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-mint-400 via-mint-500 to-coral-500">
          {profileImage ? (
            <img src={profileImage} alt="프로필 이미지" className="h-full w-full object-cover" />
          ) : (
            <span className="text-[26px] font-bold leading-none tracking-tight text-white">
              {initial}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="mb-1.5 text-[18px] font-bold leading-tight tracking-tight text-gray-900">
            {name}
          </h2>
          <span className="inline-flex items-center rounded-full bg-mint-100 px-2.5 py-1 text-xs font-bold text-mint-600">
            {levelLabel}
          </span>
        </div>
        <button
          type="button"
          aria-label="프로필 편집"
          onClick={() => setIsEditOpen(true)}
          className="absolute right-0 top-0 flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-700 active:bg-gray-200"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>
      </div>

      <div className="mt-5 border-t border-gray-100 pt-[18px]">
        <div className="mb-2.5 flex items-center justify-between">
          <span className="text-[13px] font-medium text-gray-600">
            매너온도
          </span>
          <span className="inline-flex items-center gap-1 text-[15px] font-bold text-gray-900 tabular-nums">
            {mannerTemperature.toFixed(1)}°C <span aria-label="친절해요">🙂</span>
          </span>
        </div>
        <div
          role="img"
          aria-label={`매너온도 ${mannerTemperature.toFixed(1)}도`}
          className="relative h-2 overflow-visible rounded-full bg-gray-100"
        >
          <div
            data-testid="temp-fill"
            className="relative h-full rounded-full bg-gradient-to-r from-mint-400 via-mint-500 to-coral-500"
            style={{ width: fillWidth }}
          >
            <span className="absolute -right-[7px] top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full bg-white shadow-[0_0_0_2px_#1FBF92,0_2px_6px_rgba(0,0,0,0.12)]" />
          </div>
        </div>
        <p className="mt-2.5 text-[12.5px] font-medium text-gray-500">
          {DEFAULT_TEMPERATURE_DESCRIPTION}
        </p>
      </div>

      {isEditOpen && (
        <ProfileEditModal
          open
          currentNickname={name}
          currentProfileImage={profileImage}
          onClose={() => setIsEditOpen(false)}
        />
      )}
    </section>
  );
}
