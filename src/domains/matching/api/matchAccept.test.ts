import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/mocks/server";
import { acceptMatch, declineMatch } from "./matchAccept";

describe("acceptMatch", () => {
  it("204 응답이면 정상 종료한다", async () => {
    await expect(acceptMatch()).resolves.toBeNull();
  });

  it("4xx 응답이면 ApiError 를 throw 한다", async () => {
    server.use(
      http.post("http://localhost:3000/api/v1/me/matching/accept", () =>
        HttpResponse.json(
          { data: null, status: 409, message: "ALREADY_RESPONDED" },
          { status: 409 },
        ),
      ),
    );

    await expect(acceptMatch()).rejects.toThrow("ALREADY_RESPONDED");
  });
});

describe("declineMatch", () => {
  it("204 응답이면 정상 종료한다", async () => {
    await expect(declineMatch()).resolves.toBeNull();
  });
});
