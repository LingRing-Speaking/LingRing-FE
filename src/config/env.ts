const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
const devUserIdRaw = import.meta.env.VITE_DEV_USER_ID;

if (!apiBaseUrl) {
  throw new Error("VITE_API_BASE_URL is not set");
}
if (!devUserIdRaw) {
  throw new Error("VITE_DEV_USER_ID is not set");
}

const SESSION_KEY = "dev_user_id";

// dev 전용: 동일 머신의 두 탭에서 서로 다른 사용자로 접속 가능하게 한다.
// 우선순위: URL `?userId=N` > sessionStorage > VITE_DEV_USER_ID
function resolveDevUserId(): number {
  if (typeof window === "undefined") return Number(devUserIdRaw);

  const url = new URL(window.location.href);
  const fromUrl = url.searchParams.get("userId");
  if (fromUrl && fromUrl.trim() !== "") {
    window.sessionStorage.setItem(SESSION_KEY, fromUrl);
    url.searchParams.delete("userId");
    window.history.replaceState({}, "", url.toString());
    return Number(fromUrl);
  }

  const fromSession = window.sessionStorage.getItem(SESSION_KEY);
  if (fromSession && fromSession.trim() !== "") return Number(fromSession);

  return Number(devUserIdRaw);
}

export const env = {
  apiBaseUrl,
  wsBaseUrl: apiBaseUrl.replace(/^http/, "ws"),
  devUserId: resolveDevUserId(),
};
