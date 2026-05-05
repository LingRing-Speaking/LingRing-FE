import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "@/mocks/server";
import { useAuthStore } from "@/domains/auth/store";
import * as storage from "@/domains/auth/storage";
import { ApiError, httpDelete, httpGet, httpPost } from "./http";

describe("httpGet", () => {
  it("2xx 응답에서 ApiResponse 를 언랩해 data 만 반환한다", async () => {
    server.use(
      http.get("http://localhost:3000/api/v1/ping", () =>
        HttpResponse.json({ data: { ok: true }, status: 200, message: "OK" }),
      ),
    );

    const result = await httpGet<{ ok: boolean }>("/ping");

    expect(result).toEqual({ ok: true });
  });

  it("4xx 응답에서 ApiError 를 throw 한다", async () => {
    server.use(
      http.get("http://localhost:3000/api/v1/me", () =>
        HttpResponse.json(
          { data: null, status: 404, message: "사용자를 찾을 수 없습니다." },
          { status: 404 },
        ),
      ),
    );

    await expect(httpGet("/me")).rejects.toMatchObject({
      name: "ApiError",
      status: 404,
      message: "사용자를 찾을 수 없습니다.",
    });
  });

  it("4xx 응답 body 에 message 필드가 없으면 Unknown error 로 throw 한다", async () => {
    server.use(
      http.get("http://localhost:3000/api/v1/nomsg", () =>
        HttpResponse.json({ data: null }, { status: 500 }),
      ),
    );

    await expect(httpGet("/nomsg")).rejects.toMatchObject({
      name: "ApiError",
      status: 500,
      message: "Unknown error",
    });
  });

  it("네트워크 실패 시 에러를 throw 한다", async () => {
    server.use(http.get("http://localhost:3000/api/v1/boom", () => HttpResponse.error()));

    await expect(httpGet("/boom")).rejects.toThrow();
  });

  it("ApiError 는 Error 의 instanceof 이다", () => {
    const err = new ApiError(500, "boom");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.name).toBe("ApiError");
    expect(err.status).toBe(500);
  });
});

describe("httpPost", () => {
  it("2xx 응답에서 ApiResponse 를 언랩해 data 만 반환한다", async () => {
    server.use(
      http.post("http://localhost:3000/api/v1/me/matching", () =>
        HttpResponse.json({
          data: null,
          status: 204,
          message: "NO_CONTENT",
        }),
      ),
    );

    const result = await httpPost<null>("/me/matching");

    expect(result).toBeNull();
  });

  it("4xx 응답에서 ApiError 를 throw 한다", async () => {
    server.use(
      http.post("http://localhost:3000/api/v1/me/matching", () =>
        HttpResponse.json(
          { data: null, status: 404, message: "사용자를 찾을 수 없습니다." },
          { status: 404 },
        ),
      ),
    );

    await expect(httpPost("/me/matching")).rejects.toMatchObject({
      name: "ApiError",
      status: 404,
      message: "사용자를 찾을 수 없습니다.",
    });
  });

  it("4xx body 에 message 가 없으면 Unknown error 로 throw 한다", async () => {
    server.use(
      http.post("http://localhost:3000/api/v1/nomsg", () =>
        HttpResponse.json({ data: null }, { status: 500 }),
      ),
    );

    await expect(httpPost("/nomsg")).rejects.toMatchObject({
      name: "ApiError",
      status: 500,
      message: "Unknown error",
    });
  });

  it("네트워크 실패 시 에러를 throw 한다", async () => {
    server.use(
      http.post("http://localhost:3000/api/v1/boom", () => HttpResponse.error()),
    );
    await expect(httpPost("/boom")).rejects.toThrow();
  });
});

describe("httpDelete", () => {
  it("2xx 응답에서 ApiResponse 를 언랩해 data 만 반환한다", async () => {
    server.use(
      http.delete("http://localhost:3000/api/v1/me/matching", () =>
        HttpResponse.json({
          data: null,
          status: 204,
          message: "NO_CONTENT",
        }),
      ),
    );

    const result = await httpDelete<null>("/me/matching");

    expect(result).toBeNull();
  });

  it("4xx 응답에서 ApiError 를 throw 한다", async () => {
    server.use(
      http.delete("http://localhost:3000/api/v1/me/matching", () =>
        HttpResponse.json(
          { data: null, status: 500, message: "BOOM" },
          { status: 500 },
        ),
      ),
    );

    await expect(httpDelete("/me/matching")).rejects.toMatchObject({
      name: "ApiError",
      status: 500,
      message: "BOOM",
    });
  });

  it("네트워크 실패 시 에러를 throw 한다", async () => {
    server.use(
      http.delete("http://localhost:3000/api/v1/boom", () => HttpResponse.error()),
    );
    await expect(httpDelete("/boom")).rejects.toThrow();
  });
});

describe("401 인터셉터 + refresh 자동 재시도", () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: { id: 1, nickname: "tester", profileImage: null },
      accessToken: "expired-access",
      refreshToken: "valid-refresh",
      isAuthenticated: true,
    });
    vi.spyOn(storage, "saveTokens").mockResolvedValue();
    vi.spyOn(storage, "clearTokens").mockResolvedValue();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    useAuthStore.setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
    });
  });

  it("401 응답 시 /auth/refresh 로 새 토큰을 받고 원 요청을 1회 재시도한다", async () => {
    let protectedCalls = 0;
    server.use(
      http.get("http://localhost:3000/api/v1/protected", ({ request }) => {
        protectedCalls += 1;
        const auth = request.headers.get("authorization");
        if (auth === "Bearer new-access") {
          return HttpResponse.json({ data: { ok: true }, status: 200, message: "OK" });
        }
        return HttpResponse.json(
          { data: null, status: 401, message: "EXPIRED" },
          { status: 401 },
        );
      }),
      http.post("http://localhost:3000/api/v1/auth/refresh", () =>
        HttpResponse.json({
          status: 200,
          message: "OK",
          data: { accessToken: "new-access", refreshToken: "new-refresh" },
        }),
      ),
    );

    const result = await httpGet<{ ok: boolean }>("/protected");

    expect(result).toEqual({ ok: true });
    expect(protectedCalls).toBe(2);
    const state = useAuthStore.getState();
    expect(state.accessToken).toBe("new-access");
    expect(state.refreshToken).toBe("new-refresh");
    expect(state.user).toEqual({ id: 1, nickname: "tester", profileImage: null });
    expect(storage.saveTokens).toHaveBeenCalledWith({
      accessToken: "new-access",
      refreshToken: "new-refresh",
    });
  });

  it("refresh 자체가 401 이면 세션을 비우고 원 요청을 재시도하지 않는다", async () => {
    let protectedCalls = 0;
    server.use(
      http.get("http://localhost:3000/api/v1/protected", () => {
        protectedCalls += 1;
        return HttpResponse.json(
          { data: null, status: 401, message: "EXPIRED" },
          { status: 401 },
        );
      }),
      http.post("http://localhost:3000/api/v1/auth/refresh", () =>
        HttpResponse.json(
          { data: null, status: 401, message: "INVALID_OR_EXPIRED_REFRESH_TOKEN" },
          { status: 401 },
        ),
      ),
    );

    await expect(httpGet("/protected")).rejects.toBeInstanceOf(ApiError);
    expect(protectedCalls).toBe(1);
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.accessToken).toBeNull();
    expect(storage.clearTokens).toHaveBeenCalled();
  });

  it("재시도 후에도 401 이면 더 이상 refresh 하지 않고 ApiError 를 throw 한다", async () => {
    let protectedCalls = 0;
    let refreshCalls = 0;
    server.use(
      http.get("http://localhost:3000/api/v1/protected", () => {
        protectedCalls += 1;
        return HttpResponse.json(
          { data: null, status: 401, message: "STILL_EXPIRED" },
          { status: 401 },
        );
      }),
      http.post("http://localhost:3000/api/v1/auth/refresh", () => {
        refreshCalls += 1;
        return HttpResponse.json({
          status: 200,
          message: "OK",
          data: { accessToken: "new-access", refreshToken: "new-refresh" },
        });
      }),
    );

    await expect(httpGet("/protected")).rejects.toBeInstanceOf(ApiError);
    expect(protectedCalls).toBe(2);
    expect(refreshCalls).toBe(1);
  });

  it("refresh token 이 없으면 refresh 시도 없이 즉시 401 을 throw 한다", async () => {
    useAuthStore.setState({
      user: null,
      accessToken: "any",
      refreshToken: null,
      isAuthenticated: false,
    });
    let refreshCalls = 0;
    server.use(
      http.get("http://localhost:3000/api/v1/protected", () =>
        HttpResponse.json(
          { data: null, status: 401, message: "EXPIRED" },
          { status: 401 },
        ),
      ),
      http.post("http://localhost:3000/api/v1/auth/refresh", () => {
        refreshCalls += 1;
        return HttpResponse.json({ data: null }, { status: 200 });
      }),
    );

    await expect(httpGet("/protected")).rejects.toBeInstanceOf(ApiError);
    expect(refreshCalls).toBe(0);
  });
});
