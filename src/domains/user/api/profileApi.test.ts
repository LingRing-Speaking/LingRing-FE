import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/mocks/server";
import { ApiError } from "@/lib/http";
import { requestProfileImagePresignedUrl, updateProfile } from "./profileApi";

const PRESIGNED_URL = "http://localhost:3000/api/v1/me/profile/image/presigned-url";
const PROFILE_URL = "http://localhost:3000/api/v1/me/profile";

describe("requestProfileImagePresignedUrl", () => {
  it("200 응답에서 uploadUrl 과 key 를 반환한다", async () => {
    server.use(
      http.post(PRESIGNED_URL, () =>
        HttpResponse.json({
          data: {
            uploadUrl: "https://s3.example.com/profile-images/1/uuid?sig=abc",
            key: "profile-images/1/uuid",
          },
          status: 200,
          message: "OK",
        }),
      ),
    );

    const result = await requestProfileImagePresignedUrl({
      contentType: "image/png",
      contentLength: 12345,
    });

    expect(result).toEqual({
      uploadUrl: "https://s3.example.com/profile-images/1/uuid?sig=abc",
      key: "profile-images/1/uuid",
    });
  });

  it("400(IMAGE_TOO_LARGE) 응답은 ApiError 로 throw 된다", async () => {
    server.use(
      http.post(PRESIGNED_URL, () =>
        HttpResponse.json(
          { data: null, status: 400, message: "이미지 크기가 허용 범위를 초과했습니다." },
          { status: 400 },
        ),
      ),
    );

    await expect(
      requestProfileImagePresignedUrl({ contentType: "image/png", contentLength: 99 }),
    ).rejects.toBeInstanceOf(ApiError);
  });
});

describe("updateProfile", () => {
  it("200 응답에서 갱신된 User 를 반환한다", async () => {
    server.use(
      http.patch(PROFILE_URL, async ({ request }) => {
        expect(await request.json()).toEqual({
          nickname: "new-name",
          profileImageKey: "profile-images/1/uuid",
        });
        return HttpResponse.json({
          data: {
            id: 1,
            nickname: "new-name",
            profileImage: "https://s3.example.com/profile-images/1/uuid",
          },
          status: 200,
          message: "OK",
        });
      }),
    );

    const result = await updateProfile({
      nickname: "new-name",
      profileImageKey: "profile-images/1/uuid",
    });

    expect(result).toEqual({
      id: 1,
      nickname: "new-name",
      profileImage: "https://s3.example.com/profile-images/1/uuid",
    });
  });

  it("409(NICKNAME_CONFLICT) 응답은 ApiError(409) 로 throw 된다", async () => {
    server.use(
      http.patch(PROFILE_URL, () =>
        HttpResponse.json(
          { data: null, status: 409, message: "이미 사용 중인 닉네임입니다." },
          { status: 409 },
        ),
      ),
    );

    await expect(updateProfile({ nickname: "taken" })).rejects.toMatchObject({
      name: "ApiError",
      status: 409,
    });
  });
});
