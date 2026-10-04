import { Capacitor, registerPlugin } from "@capacitor/core";

// iOS 설정 URL. 웹뷰 링크로 열면 시스템이 처리한다 (둘 다 기기에서 확인).
// - UIApplication.openSettingsURLString: 앱 설정 화면
// - UIApplication.openNotificationSettingsURLString (iOS 16+): 앱 알림 설정 화면으로 바로
const IOS_APP_SETTINGS_URL = "app-settings:";
const IOS_NOTIFICATION_SETTINGS_URL = "app-settings:notifications";
const IOS_NOTIFICATION_SETTINGS_MIN_MAJOR = 16;

// WKWebView User-Agent 의 "iPhone OS 17_5 like Mac OS X" 에서 메이저 버전을 읽는다.
const IOS_VERSION_PATTERN = /OS (\d+)_/;

/** 알림 설정 화면으로 바로 갈 수 있으면(iOS 16+) 그 URL, 아니면(iOS 15·버전 미상) 앱 설정 화면 URL. */
export function getIosAppSettingsUrl(userAgent: string = navigator.userAgent): string {
  const major = Number(IOS_VERSION_PATTERN.exec(userAgent)?.[1]);
  return major >= IOS_NOTIFICATION_SETTINGS_MIN_MAJOR
    ? IOS_NOTIFICATION_SETTINGS_URL
    : IOS_APP_SETTINGS_URL;
}

// Android 네이티브 플러그인 (android/.../AppSettingsPlugin.java).
const ANDROID_PLUGIN_NAME = "AppSettings";

interface AppSettingsPlugin {
  openNotificationSettings(): Promise<void>;
}

const AppSettings = registerPlugin<AppSettingsPlugin>(ANDROID_PLUGIN_NAME);

export type NotificationSettingsOpener = "ios-link" | "android-plugin";

/**
 * 기기의 앱 알림 설정 화면을 여는 방법. 열 수 없으면 null.
 * Android 플러그인은 스토어 바이너리에만 들어 있어, 플러그인이 없는 옛 앱에 새 JS 가
 * OTA 로 올라간 경우를 대비해 존재 여부를 확인한다.
 */
export function getNotificationSettingsOpener(): NotificationSettingsOpener | null {
  const platform = Capacitor.getPlatform();
  if (platform === "ios") return "ios-link";
  if (platform === "android" && Capacitor.isPluginAvailable(ANDROID_PLUGIN_NAME)) {
    return "android-plugin";
  }
  return null;
}

export function openAndroidNotificationSettings(): Promise<void> {
  return AppSettings.openNotificationSettings();
}
