import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/mocks/server";
import { createBlock, deleteBlock, fetchBlockedUsers } from "./blockApi";

describe("createBlock", () => {
  it("Block 데이터를 반환한다", async () => {
    const result = await createBlock({ blockedUserId: 42 });
    expect(result.blockedUserId).toBe(42);
    expect(typeof result.userId).toBe("number");
    expect(typeof result.createdAt).toBe("string");
  });

  it("요청 바디는 blockedUserId 그대로 전달된다", async () => {
    let received: unknown = null;
    server.use(
      http.post("http://localhost:3000/api/v1/blocks", async ({ request }) => {
        received = await request.json();
        return HttpResponse.json(
          {
            data: {
              id: 99,
              userId: 1,
              blockedUserId: 42,
              createdAt: "2026-05-17T12:34:56",
            },
            status: 201,
            message: "CREATED",
          },
          { status: 201 },
        );
      }),
    );

    await createBlock({ blockedUserId: 42 });
    expect(received).toEqual({ blockedUserId: 42 });
  });

  it("400 SELF_BLOCK_NOT_ALLOWED 면 ApiError 를 throw 한다", async () => {
    server.use(
      http.post("http://localhost:3000/api/v1/blocks", () =>
        HttpResponse.json(
          { data: null, status: 400, message: "SELF_BLOCK_NOT_ALLOWED" },
          { status: 400 },
        ),
      ),
    );

    await expect(createBlock({ blockedUserId: 1 })).rejects.toThrow("SELF_BLOCK_NOT_ALLOWED");
  });
});

describe("deleteBlock", () => {
  it("204 응답이면 정상 종료한다", async () => {
    await expect(deleteBlock(42)).resolves.toBeNull();
  });

  it("path 에 blockedUserId 가 박힌다", async () => {
    let receivedUrl = "";
    server.use(
      http.delete("http://localhost:3000/api/v1/blocks/:blockedUserId", ({ request }) => {
        receivedUrl = request.url;
        return HttpResponse.json({
          data: null,
          status: 204,
          message: "NO_CONTENT",
        });
      }),
    );

    await deleteBlock(42);
    expect(receivedUrl).toContain("/blocks/42");
  });
});

describe("fetchBlockedUsers", () => {
  it("items 와 hasNext 를 반환한다", async () => {
    const result = await fetchBlockedUsers(0, 20);
    expect(Array.isArray(result.items)).toBe(true);
    expect(typeof result.hasNext).toBe("boolean");
  });

  it("쿼리스트링에 page/size 가 박힌다", async () => {
    let receivedUrl = "";
    server.use(
      http.get("http://localhost:3000/api/v1/blocks", ({ request }) => {
        receivedUrl = request.url;
        return HttpResponse.json({
          data: { items: [], hasNext: false },
          status: 200,
          message: "OK",
        });
      }),
    );

    await fetchBlockedUsers(2, 10);
    expect(receivedUrl).toContain("page=2");
    expect(receivedUrl).toContain("size=10");
  });
});
