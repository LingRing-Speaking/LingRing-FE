const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
const devUserIdRaw = import.meta.env.VITE_DEV_USER_ID;

if (!apiBaseUrl) {
  throw new Error("VITE_API_BASE_URL is not set");
}
if (!devUserIdRaw) {
  throw new Error("VITE_DEV_USER_ID is not set");
}

export const env = {
  apiBaseUrl,
  wsBaseUrl: apiBaseUrl.replace(/^http/, "ws"),
  // TODO(#31 후속): devUserId 사용처(MainPage·MatchingPage·UserExpressionsPage·CallHistoryPage·CallPage)를
  // useAuthStore.user.id 로 마이그레이션 후 본 필드 + VITE_DEV_USER_ID 제거.
  devUserId: Number(devUserIdRaw),
};
