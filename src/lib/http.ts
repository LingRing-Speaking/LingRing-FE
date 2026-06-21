import { env } from "@/config/env";
import { useAuthStore } from "@/domains/auth/store";
import { clearTokens, saveTokens } from "@/domains/auth/storage";

const API_PREFIX = "/api/v1";
const REFRESH_PATH = "/auth/refresh";
const UNAUTHORIZED_STATUS = 401;
const NETWORK_ERROR_STATUS = 0;

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
type RefreshOutcome = "refreshed" | "rejected" | "unavailable";

let refreshInFlight: Promise<RefreshOutcome> | null = null;

async function refreshAccessToken(): Promise<RefreshOutcome> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = doRefresh().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

// refresh 결과를 3가지로 구분한다:
// - refreshed:   새 토큰 발급 성공 → 원 요청 재시도
// - rejected:    refresh 가 "진짜로 거부됨"(401/400, refresh 토큰 만료·무효) → 세션 종료
// - unavailable: refresh 를 "완료하지 못함"(네트워크 단절/5xx) → 토큰 보존, 일시 오류로 처리
// 이 구분이 없으면 콜드스타트/배포 중 일시 장애가 인증 실패로 오인되어 멀쩡한 세션이 삭제된다.
async function doRefresh(): Promise<RefreshOutcome> {
  const refreshToken = useAuthStore.getState().refreshToken;
  if (!refreshToken) return "rejected";

  let res: Response;
  try {
    res = await fetch(buildUrl(REFRESH_PATH), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
  } catch {
    return "unavailable";
  }

  if (res.status >= 500) return "unavailable";
  if (!res.ok) return "rejected";

  const body = await res.json().catch(() => null);
  const tokens = (body as { data?: { accessToken?: string; refreshToken?: string } } | null)?.data;
  if (!tokens?.accessToken || !tokens?.refreshToken) return "rejected";

  useAuthStore.getState().updateTokens({
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  });
  await saveTokens({
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  });
  return "refreshed";
}

async function request<T>(
  path: string,
  init?: RequestInit,
  alreadyRetried = false,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(buildUrl(path), withAuthHeader(init));
  } catch {
    throw new ApiError(NETWORK_ERROR_STATUS, "Network request failed");
  }

  // refresh 토큰이 있을 때만(=세션이 있을 때만) refresh 를 시도한다.
  // 로그인 엔드포인트(/auth/social 등)나 비로그인 상태의 401 은 세션 만료가 아니므로
  // refresh·세션정리 흐름에 들어가지 않고 원래 에러를 그대로 surface 한다.
  if (
    res.status === UNAUTHORIZED_STATUS &&
    !alreadyRetried &&
    path !== REFRESH_PATH &&
    useAuthStore.getState().refreshToken !== null
  ) {
    const outcome = await refreshAccessToken();
    if (outcome === "refreshed") {
      return request<T>(path, init, true);
    }
    if (outcome === "rejected") {
      useAuthStore.getState().clearSession();
      await clearTokens();
      throw new ApiError(UNAUTHORIZED_STATUS, "Session expired");
    }
    // unavailable: refresh 를 완료하지 못함(네트워크/5xx).
    // 401(인증 실패)로 surface 하지 않는다 → 토큰 보존, 네트워크 오류로 던진다.
    throw new ApiError(NETWORK_ERROR_STATUS, "Token refresh unavailable");
  }

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const message =
      typeof body === "object" && body !== null && "message" in body
        ? String((body as { message: unknown }).message)
        : "Unknown error";
    throw new ApiError(res.status, message);
  }

  // 방어용 fallback: 정상적으로 BE 는 에러를 실제 HTTP status 로 응답하지만,
  // 혹시 HTTP 200 으로 내려오면서 envelope body.status 만 비-2xx 인 경우에도
  // ApiError 로 처리한다.
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
  let res: Response;
  try {
    res = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body,
    });
  } catch {
    throw new ApiError(NETWORK_ERROR_STATUS, "Network request failed");
  }
  if (!res.ok) {
    throw new ApiError(res.status, `S3 PUT failed: ${res.status}`);
  }
}
