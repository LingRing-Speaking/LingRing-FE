import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/mocks/server";
import { ApiError } from "@/lib/http";
import { postSocialLogin } from "./socialLogin";

describe("postSocialLogin", () => {
  it("happy path — 200 응답을 언랩해 SocialLoginResponse를 반환한다", async () => {
    server.use(
      http.post("http://localhost:3000/auth/social", () =>
        HttpResponse.json({
          status: 200,
          message: "OK",
          data: {
            accessToken: "access-jwt",
            refreshToken: "refresh-jwt",
            user: { id: 42, nickname: "funny-otter-1234" },
          },
        }),
      ),
    );

    const result = await postSocialLogin({
      provider: "kakao",
      idToken: "id-jwt",
      accessToken: "kakao-access",
      nickname: "funny-otter-1234",
    });

    expect(result.user.id).toBe(42);
    expect(result.accessToken).toBe("access-jwt");
  });

  it("401(INVALID_ID_TOKEN) 응답은 ApiError(status 401)로 throw된다", async () => {
    server.use(
      http.post("http://localhost:3000/auth/social", () =>
        HttpResponse.json(
          { data: null, status: 401, message: "invalid id token" },
          { status: 401 },
        ),
      ),
    );

    await expect(postSocialLogin({ provider: "kakao", idToken: "id-jwt" })).rejects.toMatchObject({
      name: "ApiError",
      status: 401,
    });
  });

  it("409(NICKNAME_CONFLICT) 응답은 ApiError(status 409)로 throw된다", async () => {
    server.use(
      http.post("http://localhost:3000/auth/social", () =>
        HttpResponse.json(
          { data: null, status: 409, message: "nickname conflict" },
          { status: 409 },
        ),
      ),
    );

    const promise = postSocialLogin({
      provider: "kakao",
      idToken: "id-jwt",
      nickname: "taken",
    });
    await expect(promise).rejects.toBeInstanceOf(ApiError);
    await expect(promise).rejects.toMatchObject({ status: 409 });
  });
});
