import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/mocks/server";
import { ApiError } from "@/lib/http";
import { withdraw } from "./withdraw";

describe("withdraw", () => {
  it("happy path — 204(NO_CONTENT) 응답이면 resolve된다", async () => {
    server.use(
      http.post("http://localhost:3000/api/v1/me/withdraw", () =>
        HttpResponse.json({ status: 204, message: "NO_CONTENT", data: null }),
      ),
    );

    await expect(withdraw({ reason: "NO_GOOD_MATCH" })).resolves.toBeNull();
  });

  it("기본 사유 선택 시 reason만 body로 전송한다 (description 키 미포함)", async () => {
    let receivedBody: unknown = null;
    server.use(
      http.post("http://localhost:3000/api/v1/me/withdraw", async ({ request }) => {
        receivedBody = await request.json();
        return HttpResponse.json({ status: 204, message: "NO_CONTENT", data: null });
      }),
    );

    await withdraw({ reason: "BUGGY" });

    expect(receivedBody).toEqual({ reason: "BUGGY" });
  });

  it("OTHER + description 동봉 시 둘 다 body로 전송한다", async () => {
    let receivedBody: unknown = null;
    server.use(
      http.post("http://localhost:3000/api/v1/me/withdraw", async ({ request }) => {
        receivedBody = await request.json();
        return HttpResponse.json({ status: 204, message: "NO_CONTENT", data: null });
      }),
    );

    await withdraw({ reason: "OTHER", description: "혼자 공부하는 게 더 잘 맞아요" });

    expect(receivedBody).toEqual({
      reason: "OTHER",
      description: "혼자 공부하는 게 더 잘 맞아요",
    });
  });

  it("500 응답이면 ApiError(status 500)로 throw된다", async () => {
    server.use(
      http.post("http://localhost:3000/api/v1/me/withdraw", () =>
        HttpResponse.json(
          { data: null, status: 500, message: "INTERNAL" },
          { status: 500 },
        ),
      ),
    );

    await expect(withdraw({ reason: "OTHER", description: "x" })).rejects.toBeInstanceOf(
      ApiError,
    );
    await expect(withdraw({ reason: "OTHER", description: "x" })).rejects.toMatchObject({
      status: 500,
    });
  });
});
