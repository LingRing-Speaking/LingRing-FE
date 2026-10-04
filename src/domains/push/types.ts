// Capacitor.getPlatform() 값 그대로 보낸다 (BE 는 대소문자 무시 파싱).
export type DevicePlatform = "ios" | "android";

// OS 알림 권한 상태 (FirebaseMessaging.checkPermissions 의 receive 값 그대로).
export type { PermissionState as PushPermission } from "@capacitor/core";
