import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useAuthStore } from "@/domains/auth/store";
import { updateNotificationSettings } from "../api/notificationSettingApi";
import { enablePush, getPushPermission } from "../pushToken";
import type { PushPermission } from "../types";
import { OpenNotificationSettingsButton } from "./OpenNotificationSettingsButton";

const DEVICE_SETTING_GUIDE = "기기 설정에서 LingRing 알림을 허용해야 받을 수 있어요.";
const GENERIC_ERROR_MESSAGE = "잠시 후 다시 시도해주세요.";

// 서버 시각(KST LocalDateTime)의 날짜 부분만 쓴다 — 타임존 변환 없이 "2026.10.02" 형태로.
function formatProcessedDate(dateTime: string): string {
  return dateTime.slice(0, 10).replaceAll("-", ".");
}

/**
 * OS 알림 권한 상태. 기기 설정에서 알림을 바꾸고 돌아온 경우도 반영되도록
 * 앱이 포그라운드로 돌아올 때마다 다시 확인한다. 확인 전에는 null.
 */
function usePushPermission() {
  const [permission, setPermission] = useState<PushPermission | null>(null);

  useEffect(() => {
    const refresh = () => {
      void getPushPermission()
        .then(setPermission)
        .catch(() => {});
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") refresh();
    };
    refresh();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  return [permission, setPermission] as const;
}

/**
 * "알림 받기" 토글. 켜져 있으면 알림이 실제로 온다 — 광고성 정보 수신 동의(서버)와
 * OS 알림 권한(기기)을 모두 갖췄을 때만 켜진 것으로 보인다.
 * 켤 때는 권한을 먼저 받고, 허용된 경우에만 동의를 저장한다(거절하면 아무것도 저장하지 않음).
 * 끌 때는 동의 철회만 저장한다(토큰은 유지).
 * 동의·철회 처리 일자를 함께 보여준다 — 정보통신망법상 처리 결과 안내.
 */
export function MarketingPushSetting() {
  const user = useAuthStore((state) => state.user);
  const updateUser = useAuthStore((state) => state.updateUser);
  const [permission, setPermission] = usePushPermission();
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);

  const mutation = useMutation({
    mutationFn: (marketingPush: boolean) => updateNotificationSettings({ marketingPush }),
    onSuccess: ({ user: updated }) => updateUser(updated),
  });

  const agreed = Boolean(user?.marketingPushAgreed);
  const isOn = agreed && permission === "granted";
  const displayedOn = mutation.isPending ? Boolean(mutation.variables) : isOn;
  const isBusy = mutation.isPending || isRequestingPermission;
  const updatedAt = user?.marketingPushUpdatedAt;

  // 동의는 남아 있지만 기기 권한이 없으면 토글은 꺼져 보이므로 "수신 동의" 일자는 숨긴다.
  const processedText = (() => {
    if (!updatedAt) return null;
    if (agreed && permission !== "granted") return null;
    return `${formatProcessedDate(updatedAt)} ${agreed ? "수신 동의" : "수신 거부"}`;
  })();

  const turnOn = async () => {
    setIsRequestingPermission(true);
    const granted = await enablePush().catch(() => false);
    setIsRequestingPermission(false);
    setPermission(granted ? "granted" : "denied");
    // 재설치·기기 변경으로 권한만 빠져 있던 유저는 동의가 이미 저장돼 있다.
    if (granted && !agreed) mutation.mutate(true);
  };

  const handleToggle = () => {
    if (displayedOn) mutation.mutate(false);
    else void turnOn();
  };

  return (
    <div className="overflow-hidden rounded-[18px] bg-white shadow-card">
      <div className="flex min-h-[52px] items-center justify-between gap-3 px-[18px] py-[15px]">
        <div className="flex-1">
          <span className="text-[15px] font-medium tracking-tight text-gray-900">알림 받기</span>
          <p className="mt-0.5 text-[12px] font-medium tracking-tight tabular-nums text-gray-400">
            광고성 정보 포함
            {processedText && ` · ${processedText}`}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={displayedOn}
          aria-label="알림 받기"
          disabled={isBusy}
          onClick={handleToggle}
          className={`relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors ${
            displayedOn ? "bg-mint-500" : "bg-gray-200"
          }`}
        >
          <span
            aria-hidden="true"
            className={`absolute left-[2px] top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow transition-transform ${
              displayedOn ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      {permission === "denied" && (
        <div className="flex items-center gap-3 border-t border-gray-100 px-[18px] py-3">
          <p className="flex-1 text-[13px] font-medium leading-relaxed tracking-tight text-gray-500">
            {DEVICE_SETTING_GUIDE}
          </p>
          <OpenNotificationSettingsButton />
        </div>
      )}

      {mutation.isError && (
        <p
          role="alert"
          className="border-t border-gray-100 px-[18px] py-3 text-[13px] font-medium leading-relaxed tracking-tight text-coral-600"
        >
          {GENERIC_ERROR_MESSAGE}
        </p>
      )}
    </div>
  );
}
