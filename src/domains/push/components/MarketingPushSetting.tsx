import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useAuthStore } from "@/domains/auth/store";
import { updateNotificationSettings } from "../api/notificationSettingApi";
import { enablePush, isPushBlocked } from "../pushToken";

const DEVICE_SETTING_GUIDE = "기기 설정에서 LingRing 알림을 허용해야 받을 수 있어요.";
const GENERIC_ERROR_MESSAGE = "잠시 후 다시 시도해주세요.";

// 서버 시각(KST LocalDateTime)의 날짜 부분만 쓴다 — 타임존 변환 없이 "2026.10.02" 형태로.
function formatProcessedDate(dateTime: string): string {
  return dateTime.slice(0, 10).replaceAll("-", ".");
}

function loadDeviceBlocked(setBlocked: (blocked: boolean) => void): Promise<void> {
  return isPushBlocked()
    .then(setBlocked)
    .catch(() => {});
}

/**
 * 광고성 알림 수신 동의 토글. 동의·철회 결과(처리 일자)를 함께 보여준다 — 정보통신망법상 처리 결과 안내.
 * 켜면 동의 저장 후 OS 알림 권한을 요청하고, 끄면 동의 철회만 저장한다(토큰은 유지).
 */
export function MarketingPushSetting() {
  const user = useAuthStore((state) => state.user);
  const updateUser = useAuthStore((state) => state.updateUser);
  const [isDeviceBlocked, setIsDeviceBlocked] = useState(false);

  useEffect(() => {
    void loadDeviceBlocked(setIsDeviceBlocked);
  }, []);

  const mutation = useMutation({
    mutationFn: (marketingPush: boolean) => updateNotificationSettings({ marketingPush }),
    onSuccess: async ({ user: updated }, marketingPush) => {
      updateUser(updated);
      if (!marketingPush) return;
      // 동의는 이미 저장됐다. 권한 요청 실패는 아래 기기 설정 안내로 드러난다.
      await enablePush().catch(() => false);
      await loadDeviceBlocked(setIsDeviceBlocked);
    },
  });

  const agreed = Boolean(user?.marketingPushAgreed);
  const displayedAgreed = mutation.isPending ? Boolean(mutation.variables) : agreed;
  const updatedAt = user?.marketingPushUpdatedAt;

  return (
    <div className="overflow-hidden rounded-[18px] bg-white shadow-card">
      <div className="flex min-h-[52px] items-center justify-between gap-3 px-[18px] py-[15px]">
        <div className="flex-1">
          <span className="text-[15px] font-medium tracking-tight text-gray-900">
            광고성 알림 수신
          </span>
          {updatedAt && (
            <p className="mt-0.5 text-[12.5px] font-medium tracking-tight tabular-nums text-gray-500">
              {formatProcessedDate(updatedAt)} {agreed ? "수신 동의" : "수신 거부"}
            </p>
          )}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={displayedAgreed}
          aria-label="광고성 알림 수신"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate(!agreed)}
          className={`relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors ${
            displayedAgreed ? "bg-mint-500" : "bg-gray-200"
          }`}
        >
          <span
            aria-hidden="true"
            className={`absolute left-[2px] top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow transition-transform ${
              displayedAgreed ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      {agreed && isDeviceBlocked && (
        <p className="border-t border-gray-100 px-[18px] py-3 text-[13px] font-medium leading-relaxed tracking-tight text-gray-500">
          {DEVICE_SETTING_GUIDE}
        </p>
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
