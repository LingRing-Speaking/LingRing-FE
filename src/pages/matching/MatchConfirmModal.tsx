import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { useConfirmCountdown } from "@/domains/matching/hooks/useConfirmCountdown";
import { useUserProfile } from "@/domains/user/hooks/useUserProfile";
import type { Level } from "@/domains/user/types";

const LEVEL_LABEL: Record<Level, string> = {
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
};

const TOTAL_MS = 15_000;
const URGENT_THRESHOLD_MS = 5_000;

const ACCEPT_HINT = "상대 응답을 기다리는 중…";
const DECLINE_HINT = "매칭 페이지로 돌아갑니다…";

type ActedAction = "accept" | "decline";

type Props = {
  partnerId: number;
  confirmDeadline: string;
  onAccept: () => void;
  onDecline: () => void;
  onTimeout?: () => void;
};

export function MatchConfirmModal({
  partnerId,
  confirmDeadline,
  onAccept,
  onDecline,
  onTimeout,
}: Props) {
  const profile = useUserProfile(partnerId);
  const { remainingMs, expired } = useConfirmCountdown(confirmDeadline);
  const timeoutFiredRef = useRef(false);
  const [acted, setActed] = useState<ActedAction | null>(null);

  useEffect(() => {
    if (!expired || timeoutFiredRef.current || acted) return;
    timeoutFiredRef.current = true;
    onTimeout?.();
  }, [expired, onTimeout, acted]);

  const handleAccept = () => {
    if (acted) return;
    setActed("accept");
    onAccept();
  };

  const handleDecline = () => {
    if (acted) return;
    setActed("decline");
    onDecline();
  };

  // 0~1 로 정규화한 잔여 비율. 막대는 width 대신 transform: scaleX 로 채워
  // iOS WKWebView 합성 레이어 고스트(아래 progressbar 주석 참고)를 피한다.
  const remainingRatio =
    remainingMs === null ? 0 : Math.max(0, Math.min(1, remainingMs / TOTAL_MS));
  const isUrgent = remainingMs !== null && remainingMs <= URGENT_THRESHOLD_MS;
  const isDisabled = acted !== null;
  const hintText =
    acted === "accept" ? ACCEPT_HINT : acted === "decline" ? DECLINE_HINT : "";

  return (
    <>
      <div
        aria-hidden="true"
        className="absolute inset-0 z-10 bg-black/45"
      />
      <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center px-6">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="match-confirm-title"
          className="pointer-events-auto relative w-full max-w-[320px] rounded-[22px] bg-white p-6 pb-5 shadow-[0_20px_50px_rgba(0,0,0,0.25)]"
        >
          <h2 id="match-confirm-title" className="sr-only">
            매칭된 상대 확인
          </h2>

          {profile.isPending && <ConfirmSkeleton />}
          {profile.isError && (
            <p className="py-6 text-center text-[14px] font-medium text-gray-700">
              상대 프로필을 불러오지 못했어요.
            </p>
          )}
          {profile.data && (
            <ConfirmBody
              nickname={profile.data.nickname}
              profileImage={profile.data.profileImage}
              level={profile.data.level}
              mannerTemperature={profile.data.mannerTemperature}
            />
          )}

          <div
            role="progressbar"
            aria-label="응답 남은 시간"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(remainingRatio * 100)}
            className="mb-5 h-1 overflow-hidden rounded-full bg-gray-100"
          >
            {/*
              막대를 width 트랜지션으로 줄이면, 남은 시간 ≤5초에 animate-confirm-pulse
              가 시작되는 순간 iOS WKWebView 가 막대를 GPU 합성 레이어로 승격시키면서
              승격 직전 민트 페인트를 고스트로 남긴다(민트는 그 지점에 얼어붙고 코랄만
              펄스+감소). transform: scaleX + 항상 켜진 will-change-transform/translateZ
              로 막대를 처음부터 안정된 합성 레이어에 두면 펄스 시작 시 재승격이 없어
              고스트가 사라진다.
            */}
            <div
              data-testid="confirm-countdown-bar"
              className={`h-full w-full origin-left transition-transform duration-200 will-change-transform ${
                isUrgent
                  ? "animate-confirm-pulse bg-coral-500"
                  : "bg-mint-500"
              }`}
              style={{ transform: `scaleX(${remainingRatio}) translateZ(0)` }}
            />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleDecline}
              disabled={isDisabled}
              className="flex-1 rounded-[14px] bg-gray-100 py-3.5 text-[15px] font-bold text-gray-800 transition active:scale-[0.98] disabled:opacity-50"
            >
              거절
            </button>
            <button
              type="button"
              onClick={handleAccept}
              disabled={isDisabled || !profile.data}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-[14px] bg-mint-500 py-3.5 text-[15px] font-bold text-white transition active:scale-[0.98] ${
                acted === "accept"
                  ? "disabled:opacity-100"
                  : "disabled:opacity-50"
              }`}
            >
              {acted === "accept" ? (
                <>
                  <CheckBadge />
                  수락함
                </>
              ) : (
                "수락"
              )}
            </button>
          </div>

          <p
            data-testid="confirm-hint"
            aria-live="polite"
            className="mt-3 min-h-4 text-center text-[12px] font-medium leading-tight tracking-tight text-gray-500"
          >
            {hintText}
          </p>
        </div>
      </div>
    </>
  );
}

function CheckBadge() {
  return (
    <span
      aria-hidden="true"
      className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-white/20 text-[11px] font-extrabold leading-none"
    >
      ✓
    </span>
  );
}

function ConfirmBody({
  nickname,
  profileImage,
  level,
  mannerTemperature,
}: {
  nickname: string;
  profileImage: string | null;
  level: Level;
  mannerTemperature: number;
}) {
  return (
    <div className="mb-5 flex flex-col items-center gap-2">
      <Avatar
        src={profileImage}
        name={nickname}
        size="xl"
        alt="상대 프로필 이미지"
        className="mb-1"
      />
      <h3 className="m-0 mt-1 text-[22px] font-bold leading-tight tracking-[-0.02em] text-gray-900">
        {nickname}
      </h3>
      <span className="inline-flex items-center rounded-full bg-mint-100 px-2.5 py-1 text-[12px] font-bold leading-none tracking-tight text-mint-600">
        {LEVEL_LABEL[level]}
      </span>
      <p className="m-0 mt-1.5 text-[13px] font-medium leading-none tracking-tight text-gray-500">
        매너온도{" "}
        <span className="font-bold tabular-nums text-gray-700">
          {mannerTemperature.toFixed(1)}°C
        </span>
      </p>
    </div>
  );
}

function ConfirmSkeleton() {
  return (
    <div className="mb-5 flex flex-col items-center gap-3 py-2">
      <div className="h-28 w-28 animate-pulse rounded-full bg-gray-100" />
      <div className="h-6 w-32 animate-pulse rounded bg-gray-100" />
      <div className="h-4 w-20 animate-pulse rounded bg-gray-100" />
    </div>
  );
}
