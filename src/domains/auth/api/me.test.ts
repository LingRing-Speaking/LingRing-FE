import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/mocks/server";
import { ApiError } from "@/lib/http";
import { getMe } from "./me";

describe("getMe", () => {
  it("happy path — 200 응답을 언랩해 User를 반환한다", async () => {
    server.use(
      http.get("http://localhost:3000/api/v1/me", () =>
        HttpResponse.json({
          status: 200,
          message: "OK",
          data: { id: 42, nickname: "happy-tiger-9821", profileImage: null },
        }),
      ),
    );

    const result = await getMe();

    expect(result).toEqual({ id: 42, nickname: "happy-tiger-9821", profileImage: null });
  });

  it("401(INVALID_OR_EXPIRED_ACCESS_TOKEN) 응답은 ApiError(status 401)로 throw된다", async () => {
    server.use(
      http.get("http://localhost:3000/api/v1/me", () =>
        HttpResponse.json(
          { data: null, status: 401, message: "INVALID_OR_EXPIRED_ACCESS_TOKEN" },
          { status: 401 },
        ),
      ),
    );

    await expect(getMe()).rejects.toBeInstanceOf(ApiError);
    await expect(getMe()).rejects.toMatchObject({ status: 401 });
  });
});
