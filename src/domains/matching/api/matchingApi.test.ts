import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/mocks/server";
import {
  cancelMatchingQueue,
  enterMatchingQueue,
  fetchMatchingStatus,
} from "./matchingApi";

describe("enterMatchingQueue", () => {
  it("204 응답이면 정상 종료한다", async () => {
    await expect(enterMatchingQueue(1)).resolves.toBeNull();
  });

  it("5xx 응답이면 ApiError 를 throw 한다", async () => {
    server.use(
      http.post("http://localhost:3000/users/1/matching", () =>
        HttpResponse.json(
          { data: null, status: 500, message: "QUEUE_UNAVAILABLE" },
          { status: 500 },
        ),
      ),
    );

    await expect(enterMatchingQueue(1)).rejects.toThrow("QUEUE_UNAVAILABLE");
  });
});

describe("cancelMatchingQueue", () => {
  it("204 응답이면 정상 종료한다", async () => {
    await expect(cancelMatchingQueue(1)).resolves.toBeNull();
  });
});

describe("fetchMatchingStatus", () => {
  it("기본 응답이면 WAITING 상태를 반환한다", async () => {
    const result = await fetchMatchingStatus(1);
    expect(result).toEqual({ status: "WAITING", partnerId: null, roomId: null });
  });

  it("MATCHED 응답이면 partnerId 가 채워져 반환된다", async () => {
    server.use(
      http.get("http://localhost:3000/users/1/matching", () =>
        HttpResponse.json({
          data: { status: "MATCHED", partnerId: 42, roomId: "11111111-1111-1111-1111-111111111111" },
          status: 200,
          message: "OK",
        }),
      ),
    );

    const result = await fetchMatchingStatus(1);
    expect(result).toEqual({ status: "MATCHED", partnerId: 42, roomId: "11111111-1111-1111-1111-111111111111" });
  });

  it("NONE 응답도 그대로 반환된다", async () => {
    server.use(
      http.get("http://localhost:3000/users/1/matching", () =>
        HttpResponse.json({
          data: { status: "NONE", partnerId: null, roomId: null },
          status: 200,
          message: "OK",
        }),
      ),
    );

    const result = await fetchMatchingStatus(1);
    expect(result.status).toBe("NONE");
  });
});
