import { Preferences } from "@capacitor/preferences";

const ACCESS_TOKEN_KEY = "lingring.auth.accessToken";
const REFRESH_TOKEN_KEY = "lingring.auth.refreshToken";

export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
}

export async function saveTokens(tokens: StoredTokens): Promise<void> {
  await Preferences.set({ key: ACCESS_TOKEN_KEY, value: tokens.accessToken });
  await Preferences.set({ key: REFRESH_TOKEN_KEY, value: tokens.refreshToken });
}

export async function loadTokens(): Promise<StoredTokens | null> {
  const access = await Preferences.get({ key: ACCESS_TOKEN_KEY });
  const refresh = await Preferences.get({ key: REFRESH_TOKEN_KEY });
  if (!access.value || !refresh.value) return null;
  return { accessToken: access.value, refreshToken: refresh.value };
}

export async function clearTokens(): Promise<void> {
  await Preferences.remove({ key: ACCESS_TOKEN_KEY });
  await Preferences.remove({ key: REFRESH_TOKEN_KEY });
}
