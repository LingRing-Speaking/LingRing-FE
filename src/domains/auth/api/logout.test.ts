import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/mocks/server";
import { ApiError } from "@/lib/http";
import { logout } from "./logout";

describe("logout", () => {
  it("happy path — 204(NO_CONTENT) 응답이면 resolve된다", async () => {
    server.use(
      http.post("http://localhost:3000/api/v1/auth/logout", () =>
        HttpResponse.json({ status: 204, message: "NO_CONTENT", data: null }),
      ),
    );

    await expect(logout()).resolves.toBeNull();
  });

  it("401 응답이면 ApiError(status 401)로 throw된다", async () => {
    server.use(
      http.post("http://localhost:3000/api/v1/auth/logout", () =>
        HttpResponse.json(
          { data: null, status: 401, message: "UNAUTHORIZED" },
          { status: 401 },
        ),
      ),
    );

    await expect(logout()).rejects.toBeInstanceOf(ApiError);
    await expect(logout()).rejects.toMatchObject({ status: 401 });
  });
});
