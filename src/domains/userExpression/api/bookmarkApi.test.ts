import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/mocks/server";
import { ApiError } from "@/lib/http";
import type { BookmarkSource } from "../types";
import { createBookmark, deleteExpression } from "./bookmarkApi";

const API = "http://localhost:3000/api/v1";

describe("bookmarkApi", () => {
  it("createBookmark 는 POST /expressions 에 source 를 실어 보내고 생성된 표현을 반환한다", async () => {
    let receivedBody: unknown = null;
    server.use(
      http.post(`${API}/expressions`, async ({ request }) => {
        receivedBody = await request.json();
        return HttpResponse.json({
          data: {
            id: 99,
            userId: 1,
            expression: "I went to school yesterday.",
            meaning: "나는 어제 학교에 갔다.",
            createdAt: "2026-07-13T00:00:00.000000",
          },
          status: 201,
          message: "CREATED",
        });
      }),
    );

    const source: BookmarkSource = {
      source: "ANALYSIS_MISTAKE",
      analysisId: 7,
      mistakeId: 3,
    };
    const result = await createBookmark(source);

    expect(receivedBody).toEqual(source);
    expect(result).toMatchObject({ id: 99, expression: expect.any(String) });
  });

  it("deleteExpression 는 DELETE /expressions/{id} 를 호출한다", async () => {
    let calledId: string | null = null;
    server.use(
      http.delete(`${API}/expressions/:id`, ({ params }) => {
        calledId = String(params.id);
        return HttpResponse.json({
          data: null,
          status: 204,
          message: "NO_CONTENT",
        });
      }),
    );

    await deleteExpression(42);

    expect(calledId).toBe("42");
  });

  it("실패 응답이면 ApiError 를 throw 한다", async () => {
    server.use(
      http.post(`${API}/expressions`, () =>
        HttpResponse.json(
          { data: null, status: 400, message: "BOOKMARK_FAILED" },
          { status: 400 },
        ),
      ),
    );

    await expect(
      createBookmark({ source: "ICEBREAKER", icebreakerId: 5 }),
    ).rejects.toBeInstanceOf(ApiError);
  });
});
