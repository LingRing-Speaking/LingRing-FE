import { env } from "@/config/env";

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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${env.apiBaseUrl}${path}`, init);
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
