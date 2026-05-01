import { env } from "@/config/env";
import { useAuthStore } from "@/domains/auth/store";
import { clearTokens, saveTokens } from "@/domains/auth/storage";

const REFRESH_PATH = "/auth/refresh";
const UNAUTHORIZED_STATUS = 401;

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

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = useAuthStore.getState().refreshToken;
  if (!refreshToken) return false;

  let res: Response;
  try {
    res = await fetch(`${env.apiBaseUrl}${REFRESH_PATH}`, {
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
  const res = await fetch(`${env.apiBaseUrl}${path}`, withAuthHeader(init));

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

  return (body as ApiResponse<T>).data;
}

function jsonInit(method: "POST" | "DELETE", body?: unknown): RequestInit {
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

export const httpDelete = <T = void>(path: string, body?: unknown): Promise<T> =>
  request<T>(path, jsonInit("DELETE", body));
