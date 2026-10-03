import { httpPatch } from "@/lib/http";
import type { User } from "@/domains/auth/types";

interface NotificationSettingsInput {
  marketingPush: boolean;
}

interface NotificationSettingsResponse {
  user: User;
}

// 철회해도 디바이스 토큰은 지우지 않는다 — BE 가 발송 대상에서 뺀다.
export function updateNotificationSettings(
  input: NotificationSettingsInput,
): Promise<NotificationSettingsResponse> {
  return httpPatch<NotificationSettingsResponse>("/me/notification-settings", input);
}
