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
  devUserId: Number(devUserIdRaw),
};
