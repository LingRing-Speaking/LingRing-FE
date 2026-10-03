import { Capacitor } from "@capacitor/core";
import { FirebaseMessaging } from "@capacitor-firebase/messaging";
import { registerDeviceToken, unregisterDeviceToken } from "./api/deviceTokenApi";
import type { DevicePlatform } from "./types";

// 로그아웃 때 해제할 토큰. 앱 시작 시 syncPushToken 이 다시 채우므로 재시작해도 비지 않는다.
let registeredToken: string | null = null;

async function canReceivePush(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  const { receive } = await FirebaseMessaging.checkPermissions();
  return receive === "granted";
}

async function registerToken(token: string): Promise<void> {
  // Firebase 콘솔 테스트 발송에 쓸 토큰을 기기 콘솔(Xcode·logcat·Safari 인스펙터)에서 확인할 수 있게 남긴다.
  console.log("[push] FCM token", token);
  await registerDeviceToken({ token, platform: Capacitor.getPlatform() as DevicePlatform });
  registeredToken = token;
}

/** 알림 권한이 이미 허용돼 있을 때만 FCM 토큰을 BE 에 등록한다. 권한을 요청하지는 않는다. */
export async function syncPushToken(): Promise<void> {
  if (!(await canReceivePush())) return;
  const { token } = await FirebaseMessaging.getToken();
  await registerToken(token);
}

/** FCM 이 토큰을 새로 발급했을 때(tokenReceived) 다시 등록한다. */
export async function handleTokenRefresh(token: string): Promise<void> {
  if (!(await canReceivePush())) return;
  await registerToken(token);
}

/** OS 알림 권한을 요청하고, 허용되면 토큰을 등록한다. 허용 여부를 돌려준다. */
export async function enablePush(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  const { receive } = await FirebaseMessaging.requestPermissions();
  if (receive !== "granted") return false;
  await syncPushToken();
  return true;
}

/** 이번 실행에서 등록한 토큰을 BE 에서 해제한다. 인증이 필요하므로 BE 로그아웃 전에 부른다. */
export async function unregisterPushToken(): Promise<void> {
  if (registeredToken === null) return;
  const token = registeredToken;
  registeredToken = null;
  await unregisterDeviceToken(token);
}

/** 사용자가 OS 설정에서 알림을 꺼 둔 상태인지. 설정 화면의 안내 문구용. */
export async function isPushBlocked(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  const { receive } = await FirebaseMessaging.checkPermissions();
  return receive === "denied";
}
