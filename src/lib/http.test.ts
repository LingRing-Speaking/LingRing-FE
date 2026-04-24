import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "../../test/msw/server";
import { ApiError, httpGet } from "./http";

describe("httpGet", () => {
  it("2xx 응답에서 ApiResponse 를 언랩해 data 만 반환한다", async () => {
    server.use(
      http.get("http://localhost:3000/ping", () =>
        HttpResponse.json({ data: { ok: true }, status: 200, message: "OK" }),
      ),
    );

    const result = await httpGet<{ ok: boolean }>("/ping");

    expect(result).toEqual({ ok: true });
  });

  it("4xx 응답에서 ApiError 를 throw 한다", async () => {
    server.use(
      http.get("http://localhost:3000/users/999/my", () =>
        HttpResponse.json(
          { data: null, status: 404, message: "사용자를 찾을 수 없습니다." },
          { status: 404 },
        ),
      ),
    );

    await expect(httpGet("/users/999/my")).rejects.toMatchObject({
      name: "ApiError",
      status: 404,
      message: "사용자를 찾을 수 없습니다.",
    });
  });

  it("네트워크 실패 시 에러를 throw 한다", async () => {
    server.use(http.get("http://localhost:3000/boom", () => HttpResponse.error()));

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
