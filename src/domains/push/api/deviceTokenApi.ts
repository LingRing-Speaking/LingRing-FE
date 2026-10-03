import { httpPost } from "@/lib/http";
import type { DevicePlatform } from "../types";

interface RegisterDeviceTokenInput {
  token: string;
  platform: DevicePlatform;
}

// BE 가 token 을 유일 키로 upsert 한다 — 같은 기기에서 계정을 바꿔 로그인하면 소유자가 옮겨진다.
export function registerDeviceToken(input: RegisterDeviceTokenInput): Promise<void> {
  return httpPost<void>("/me/device-tokens", input);
}

// body 가 필요해 DELETE 대신 POST 액션 endpoint 를 쓴다. 내 소유가 아니거나 없어도 204.
export function unregisterDeviceToken(token: string): Promise<void> {
  return httpPost<void>("/me/device-tokens/unregister", { token });
}
