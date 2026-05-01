import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "@/mocks/server";
import * as storage from "./storage";
import { useAuthStore } from "./store";
import { restoreSession } from "./sessionRestore";

describe("restoreSession", () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
    });
    vi.spyOn(storage, "saveTokens").mockResolvedValue();
    vi.spyOn(storage, "clearTokens").mockResolvedValue();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("토큰이 없으면 no_tokens 를 반환한다", async () => {
    vi.spyOn(storage, "loadTokens").mockResolvedValue(null);

    const result = await restoreSession();

    expect(result).toEqual({ kind: "no_tokens" });
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it("토큰이 유효하면 user 를 fetch 해 setSession 후 restored 를 반환한다", async () => {
    vi.spyOn(storage, "loadTokens").mockResolvedValue({
      accessToken: "valid-access",
      refreshToken: "valid-refresh",
    });
    server.use(
      http.get("http://localhost:3000/auth/me", () =>
        HttpResponse.json({
          status: 200,
          message: "OK",
          data: { id: 7, nickname: "happy-otter-1234" },
        }),
      ),
    );

    const result = await restoreSession();

    expect(result).toEqual({ kind: "restored" });
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user).toEqual({ id: 7, nickname: "happy-otter-1234" });
    expect(state.accessToken).toBe("valid-access");
    expect(state.refreshToken).toBe("valid-refresh");
  });

  it("토큰이 만료되고 refresh 도 실패하면 세션을 비우고 invalid 를 반환한다", async () => {
    vi.spyOn(storage, "loadTokens").mockResolvedValue({
      accessToken: "expired-access",
      refreshToken: "expired-refresh",
    });
    server.use(
      http.get("http://localhost:3000/auth/me", () =>
        HttpResponse.json(
          { data: null, status: 401, message: "EXPIRED" },
          { status: 401 },
        ),
      ),
      http.post("http://localhost:3000/auth/refresh", () =>
        HttpResponse.json(
          { data: null, status: 401, message: "INVALID_OR_EXPIRED_REFRESH_TOKEN" },
          { status: 401 },
        ),
      ),
    );

    const result = await restoreSession();

    expect(result).toEqual({ kind: "invalid" });
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.accessToken).toBeNull();
    expect(state.refreshToken).toBeNull();
    expect(storage.clearTokens).toHaveBeenCalled();
  });

  it("access token 만 만료된 경우 인터셉터가 refresh 후 user 를 받아오고 restored 를 반환한다", async () => {
    vi.spyOn(storage, "loadTokens").mockResolvedValue({
      accessToken: "expired-access",
      refreshToken: "valid-refresh",
    });
    server.use(
      http.get("http://localhost:3000/auth/me", ({ request }) => {
        const auth = request.headers.get("authorization");
        if (auth === "Bearer fresh-access") {
          return HttpResponse.json({
            status: 200,
            message: "OK",
            data: { id: 7, nickname: "happy-otter-1234" },
          });
        }
        return HttpResponse.json(
          { data: null, status: 401, message: "EXPIRED" },
          { status: 401 },
        );
      }),
      http.post("http://localhost:3000/auth/refresh", () =>
        HttpResponse.json({
          status: 200,
          message: "OK",
          data: { accessToken: "fresh-access", refreshToken: "fresh-refresh" },
        }),
      ),
    );

    const result = await restoreSession();

    expect(result).toEqual({ kind: "restored" });
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.accessToken).toBe("fresh-access");
    expect(state.refreshToken).toBe("fresh-refresh");
    expect(state.user).toEqual({ id: 7, nickname: "happy-otter-1234" });
  });

  it("네트워크 오류이면 세션을 건드리지 않고 network_error 를 반환한다", async () => {
    vi.spyOn(storage, "loadTokens").mockResolvedValue({
      accessToken: "valid-access",
      refreshToken: "valid-refresh",
    });
    server.use(http.get("http://localhost:3000/auth/me", () => HttpResponse.error()));

    const result = await restoreSession();

    expect(result).toEqual({ kind: "network_error" });
    expect(storage.clearTokens).not.toHaveBeenCalled();
  });
});
