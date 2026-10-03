import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/mocks/server";
import { updateNotificationSettings } from "./notificationSettingApi";

const URL = "http://localhost:3000/api/v1/me/notification-settings";

describe("updateNotificationSettings", () => {
  it("marketingPush 를 PATCH 로 보내고 갱신된 user 를 돌려준다", async () => {
    let receivedBody: unknown = null;
    const user = {
      id: 1,
      nickname: "tester",
      profileImage: null,
      marketingPushAgreed: true,
      marketingPushUpdatedAt: "2026-10-02T20:00:00",
    };
    server.use(
      http.patch(URL, async ({ request }) => {
        receivedBody = await request.json();
        return HttpResponse.json({ data: { user }, status: 200, message: "OK" });
      }),
    );

    const result = await updateNotificationSettings({ marketingPush: true });

    expect(receivedBody).toEqual({ marketingPush: true });
    expect(result).toEqual({ user });
  });

  it("500 응답이면 ApiError(status 500)로 throw된다", async () => {
    server.use(
      http.patch(URL, () =>
        HttpResponse.json({ data: null, status: 500, message: "INTERNAL" }, { status: 500 }),
      ),
    );

    await expect(updateNotificationSettings({ marketingPush: false })).rejects.toMatchObject({
      status: 500,
    });
  });
});
