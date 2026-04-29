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

export const httpGet = <T>(path: string): Promise<T> => request<T>(path);

export const httpPost = <T = void>(path: string): Promise<T> =>
  request<T>(path, { method: "POST" });

export const httpDelete = <T = void>(path: string): Promise<T> =>
  request<T>(path, { method: "DELETE" });
