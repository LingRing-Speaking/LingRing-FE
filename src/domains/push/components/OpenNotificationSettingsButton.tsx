import {
  getIosAppSettingsUrl,
  getNotificationSettingsOpener,
  openAndroidNotificationSettings,
} from "../notificationSettings";

const LABEL = "설정 열기";
const CLASS_NAME =
  "shrink-0 rounded-[10px] bg-gray-100 px-3 py-1.5 text-[13px] font-bold tracking-tight text-gray-800 active:bg-gray-200";

/**
 * 기기의 LingRing 알림 설정 화면으로 보내는 버튼. 권한을 한 번 거절하면 OS 가 팝업을
 * 다시 띄우지 않으므로, 유저가 직접 켤 수 있게 설정 화면으로 안내한다.
 * iOS 는 설정 링크(16+ 알림 화면, 15 앱 설정 화면), Android 는 네이티브 플러그인으로 연다.
 */
export function OpenNotificationSettingsButton() {
  const opener = getNotificationSettingsOpener();

  if (opener === "ios-link") {
    return (
      <a href={getIosAppSettingsUrl()} className={CLASS_NAME}>
        {LABEL}
      </a>
    );
  }
  if (opener === "android-plugin") {
    return (
      <button
        type="button"
        onClick={() => void openAndroidNotificationSettings().catch(() => {})}
        className={CLASS_NAME}
      >
        {LABEL}
      </button>
    );
  }
  return null;
}
