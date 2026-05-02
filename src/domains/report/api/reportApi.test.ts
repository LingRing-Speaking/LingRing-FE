import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/mocks/server";
import { submitReport } from "./reportApi";

describe("submitReport", () => {
  it("204 응답이면 정상 종료한다", async () => {
    await expect(
      submitReport({
        reportedUserId: 7,
        reason: "BAD_MANNERS",
        description: "통화 내내 욕설을 했어요",
      }),
    ).resolves.toBeNull();
  });

  it("요청 바디는 reportedUserId/reason/description 그대로 전달된다", async () => {
    let received: unknown = null;
    server.use(
      http.post("http://localhost:3000/api/v1/reports", async ({ request }) => {
        received = await request.json();
        return HttpResponse.json({
          data: null,
          status: 204,
          message: "NO_CONTENT",
        });
      }),
    );

    await submitReport({
      reportedUserId: 42,
      reason: "INAPPROPRIATE_CONVERSATION",
      description: "부적절한 표현 반복",
    });

    expect(received).toEqual({
      reportedUserId: 42,
      reason: "INAPPROPRIATE_CONVERSATION",
      description: "부적절한 표현 반복",
    });
  });

  it("4xx 응답이면 ApiError 를 throw 한다", async () => {
    server.use(
      http.post("http://localhost:3000/api/v1/reports", () =>
        HttpResponse.json(
          { data: null, status: 409, message: "ALREADY_REPORTED" },
          { status: 409 },
        ),
      ),
    );

    await expect(
      submitReport({
        reportedUserId: 7,
        reason: "OTHER",
        description: "이미 신고한 사용자",
      }),
    ).rejects.toThrow("ALREADY_REPORTED");
  });
});
