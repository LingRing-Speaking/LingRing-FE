import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/mocks/server";
import { ApiError } from "@/lib/http";
import { registerDeviceToken, unregisterDeviceToken } from "./deviceTokenApi";

const NO_CONTENT = { status: 204, message: "NO_CONTENT", data: null };

describe("registerDeviceToken", () => {
  it("token 과 platform 을 body 로 POST /me/device-tokens 에 보낸다", async () => {
    let receivedBody: unknown = null;
    server.use(
      http.post("http://localhost:3000/api/v1/me/device-tokens", async ({ request }) => {
        receivedBody = await request.json();
        return HttpResponse.json(NO_CONTENT);
      }),
    );

    await registerDeviceToken({ token: "fcm-token", platform: "ios" });

    expect(receivedBody).toEqual({ token: "fcm-token", platform: "ios" });
  });

  it("401 응답이면 ApiError(status 401)로 throw된다", async () => {
    server.use(
      http.post("http://localhost:3000/api/v1/me/device-tokens", () =>
        HttpResponse.json({ data: null, status: 401, message: "UNAUTHORIZED" }, { status: 401 }),
      ),
    );

    await expect(
      registerDeviceToken({ token: "fcm-token", platform: "android" }),
    ).rejects.toMatchObject({ status: 401 });
  });
});

describe("unregisterDeviceToken", () => {
  it("token 을 body 로 POST /me/device-tokens/unregister 에 보낸다", async () => {
    let receivedBody: unknown = null;
    server.use(
      http.post("http://localhost:3000/api/v1/me/device-tokens/unregister", async ({ request }) => {
        receivedBody = await request.json();
        return HttpResponse.json(NO_CONTENT);
      }),
    );

    await unregisterDeviceToken("fcm-token");

    expect(receivedBody).toEqual({ token: "fcm-token" });
  });

  it("500 응답이면 ApiError 로 throw된다", async () => {
    server.use(
      http.post("http://localhost:3000/api/v1/me/device-tokens/unregister", () =>
        HttpResponse.json({ data: null, status: 500, message: "INTERNAL" }, { status: 500 }),
      ),
    );

    await expect(unregisterDeviceToken("fcm-token")).rejects.toBeInstanceOf(ApiError);
  });
});
