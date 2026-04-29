import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/mocks/server";
import { fetchRandomIcebreakers } from "./icebreakerApi";

describe("icebreakerApi", () => {
  it("기본 count(5)로 호출하면 5개의 아이스브레이커 배열을 반환한다", async () => {
    const result = await fetchRandomIcebreakers();

    expect(result).toHaveLength(5);
    expect(result[0]).toMatchObject({
      id: expect.any(Number),
      expression: expect.any(String),
      meaning: expect.any(String),
    });
  });

  it("count 파라미터를 query string 으로 전달한다", async () => {
    let receivedCount: string | null = null;
    server.use(
      http.get("http://localhost:3000/icebreakers", ({ request }) => {
        receivedCount = new URL(request.url).searchParams.get("count");
        return HttpResponse.json({
          data: { items: [] },
          status: 200,
          message: "OK",
        });
      }),
    );

    await fetchRandomIcebreakers(3);

    expect(receivedCount).toBe("3");
  });

  it("500 응답이면 ApiError 를 throw 한다", async () => {
    server.use(
      http.get("http://localhost:3000/icebreakers", () =>
        HttpResponse.json(
          { data: null, status: 500, message: "ICEBREAKER_FETCH_FAILED" },
          { status: 500 },
        ),
      ),
    );

    await expect(fetchRandomIcebreakers()).rejects.toThrow(
      "ICEBREAKER_FETCH_FAILED",
    );
  });
});
