import { env } from "@/config/env";
import { useAuthStore } from "@/domains/auth/store";
import { clearTokens, saveTokens } from "@/domains/auth/storage";

const API_PREFIX = "/api/v1";
const REFRESH_PATH = "/auth/refresh";
const UNAUTHORIZED_STATUS = 401;

const buildUrl = (path: string) => `${env.apiBaseUrl}${API_PREFIX}${path}`;

type ApiResponse<T> = { data: T; status: number; message: string };

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function withAuthHeader(init?: RequestInit): RequestInit | undefined {
  const token = useAuthStore.getState().accessToken;
  if (!token) return init;
  return {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${token}`,
    },
  };
}

// 동시에 여러 요청이 401 을 받아도 /auth/refresh 는 단 1회만 발사되도록 게이팅한다.
// BE 는 refresh 토큰을 회전시키며 옛 토큰 재사용 시 모든 세션을 폐기하므로
// (TokenIssuer.rotate + reuse detection), 동시 호출을 막지 않으면 race 로 즉시 로그아웃된다.
let refreshInFlight: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = doRefresh().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

async function doRefresh(): Promise<boolean> {
  const refreshToken = useAuthStore.getState().refreshToken;
  if (!refreshToken) return false;

  let res: Response;
  try {
    res = await fetch(buildUrl(REFRESH_PATH), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
  } catch {
    return false;
  }

  if (!res.ok) {
    useAuthStore.getState().clearSession();
    await clearTokens();
    return false;
  }

  const body = await res.json().catch(() => null);
  const tokens = (body as { data?: { accessToken?: string; refreshToken?: string } } | null)?.data;
  if (!tokens?.accessToken || !tokens?.refreshToken) {
    useAuthStore.getState().clearSession();
    await clearTokens();
    return false;
  }

  useAuthStore.getState().updateTokens({
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  });
  await saveTokens({
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  });
  return true;
}

async function request<T>(
  path: string,
  init?: RequestInit,
  alreadyRetried = false,
): Promise<T> {
  const res = await fetch(buildUrl(path), withAuthHeader(init));

  if (res.status === UNAUTHORIZED_STATUS && !alreadyRetried && path !== REFRESH_PATH) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return request<T>(path, init, true);
    }
  }

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const message =
      typeof body === "object" && body !== null && "message" in body
        ? String((body as { message: unknown }).message)
        : "Unknown error";
    throw new ApiError(res.status, message);
  }

  // BE 컨벤션: GlobalExceptionHandler 가 에러도 HTTP 200 으로 응답하면서
  // envelope body.status 에 진짜 의미 status (예: 400, 409) 를 박는다.
  // → HTTP status 가 정상이어도 envelope status 가 비-2xx 면 ApiError throw.
  const envelope = body as { status?: unknown; message?: unknown };
  if (
    typeof envelope.status === "number" &&
    (envelope.status < 200 || envelope.status >= 300)
  ) {
    const message =
      typeof envelope.message === "string" ? envelope.message : "Unknown error";
    throw new ApiError(envelope.status, message);
  }

  return (body as ApiResponse<T>).data;
}

function jsonInit(
  method: "POST" | "DELETE" | "PATCH",
  body?: unknown,
): RequestInit {
  if (body === undefined) return { method };
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

export const httpGet = <T>(path: string): Promise<T> => request<T>(path);

export const httpPost = <T = void>(path: string, body?: unknown): Promise<T> =>
  request<T>(path, jsonInit("POST", body));

export const httpPatch = <T = void>(path: string, body?: unknown): Promise<T> =>
  request<T>(path, jsonInit("PATCH", body));

export const httpDelete = <T = void>(path: string, body?: unknown): Promise<T> =>
  request<T>(path, jsonInit("DELETE", body));

/**
 * 외부 절대 URL(예: S3 presigned URL)에 인증 헤더 없이 raw PUT 한다.
 * presigned URL에 Authorization 헤더가 붙으면 S3가 서명 불일치로 거부하므로
 * 기존 request() 래퍼를 우회한다.
 */
export async function httpPutRaw(
  uploadUrl: string,
  body: Blob,
  contentType: string,
): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body,
  });
  if (!res.ok) {
    throw new ApiError(res.status, `S3 PUT failed: ${res.status}`);
  }
}
