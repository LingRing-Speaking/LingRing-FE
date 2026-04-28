import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "../../test/msw/server";
import { ApiError, httpGet, httpPost } from "./http";

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

  it("4xx 응답 body 에 message 필드가 없으면 Unknown error 로 throw 한다", async () => {
    server.use(
      http.get("http://localhost:3000/nomsg", () =>
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

describe("httpPost", () => {
  it("2xx 응답에서 ApiResponse 를 언랩해 data 만 반환한다", async () => {
    server.use(
      http.post("http://localhost:3000/users/1/matching", () =>
        HttpResponse.json({
          data: null,
          status: 204,
          message: "NO_CONTENT",
        }),
      ),
    );

    const result = await httpPost<null>("/users/1/matching");

    expect(result).toBeNull();
  });

  it("4xx 응답에서 ApiError 를 throw 한다", async () => {
    server.use(
      http.post("http://localhost:3000/users/999/matching", () =>
        HttpResponse.json(
          { data: null, status: 404, message: "사용자를 찾을 수 없습니다." },
          { status: 404 },
        ),
      ),
    );

    await expect(httpPost("/users/999/matching")).rejects.toMatchObject({
      name: "ApiError",
      status: 404,
      message: "사용자를 찾을 수 없습니다.",
    });
  });

  it("4xx body 에 message 가 없으면 Unknown error 로 throw 한다", async () => {
    server.use(
      http.post("http://localhost:3000/nomsg", () =>
        HttpResponse.json({ data: null }, { status: 500 }),
      ),
    );

    await expect(httpPost("/nomsg")).rejects.toMatchObject({
      name: "ApiError",
      status: 500,
      message: "Unknown error",
    });
  });
});
