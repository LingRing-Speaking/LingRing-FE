import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { server } from "@/mocks/server";
import { useAuthStore } from "@/domains/auth/store";
import { createTestQueryClient } from "../../../../test/utils/renderWithQueryClient";
import { useUpdateProfile } from "./useUpdateProfile";

const PRESIGNED_URL = "http://localhost:3000/api/v1/me/profile/image/presigned-url";
const PROFILE_URL = "http://localhost:3000/api/v1/me/profile";
const S3_URL = "https://s3.example.com/profile-images/1/uuid";

const wrapper = ({ children }: { children: ReactNode }) => {
  const queryClient = createTestQueryClient();
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

beforeEach(() => {
  useAuthStore.setState({
    user: { id: 1, nickname: "old", profileImage: null },
    accessToken: "test-access",
    refreshToken: "test-refresh",
    isAuthenticated: true,
  });
});

afterEach(() => {
  useAuthStore.setState({
    user: null,
    accessToken: null,
    refreshToken: null,
    isAuthenticated: false,
  });
});

describe("useUpdateProfile", () => {
  it("닉네임만 변경하면 presigned/PUT 호출 없이 PATCH 만 보낸다", async () => {
    let presignedCalls = 0;
    let s3Calls = 0;
    let patchedBody: unknown = null;
    server.use(
      http.post(PRESIGNED_URL, () => {
        presignedCalls += 1;
        return HttpResponse.json({ data: null, status: 200, message: "OK" });
      }),
      http.put(S3_URL, () => {
        s3Calls += 1;
        return new HttpResponse(null, { status: 200 });
      }),
      http.patch(PROFILE_URL, async ({ request }) => {
        patchedBody = await request.json();
        return HttpResponse.json({
          data: { id: 1, nickname: "new", profileImage: null },
          status: 200,
          message: "OK",
        });
      }),
    );

    const { result } = renderHook(() => useUpdateProfile(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ nickname: "new" });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(presignedCalls).toBe(0);
    expect(s3Calls).toBe(0);
    expect(patchedBody).toEqual({ nickname: "new" });
    expect(useAuthStore.getState().user).toEqual({
      id: 1,
      nickname: "new",
      profileImage: null,
    });
  });

  it("이미지만 변경하면 presigned → PUT → PATCH 순서로 호출되고 store 가 갱신된다", async () => {
    const sequence: string[] = [];
    let patchedBody: unknown = null;
    server.use(
      http.post(PRESIGNED_URL, async ({ request }) => {
        sequence.push("presigned");
        expect(await request.json()).toEqual({
          contentType: "image/png",
          contentLength: 4,
        });
        return HttpResponse.json({
          data: { uploadUrl: S3_URL, key: "profile-images/1/uuid" },
          status: 200,
          message: "OK",
        });
      }),
      http.put(S3_URL, () => {
        sequence.push("s3");
        return new HttpResponse(null, { status: 200 });
      }),
      http.patch(PROFILE_URL, async ({ request }) => {
        sequence.push("patch");
        patchedBody = await request.json();
        return HttpResponse.json({
          data: {
            id: 1,
            nickname: "old",
            profileImage: "https://cdn.example.com/profile-images/1/uuid",
          },
          status: 200,
          message: "OK",
        });
      }),
    );

    const file = new File([new Uint8Array(4)], "p.png", { type: "image/png" });
    const { result } = renderHook(() => useUpdateProfile(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ file });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(sequence).toEqual(["presigned", "s3", "patch"]);
    expect(patchedBody).toEqual({ profileImageKey: "profile-images/1/uuid" });
    expect(useAuthStore.getState().user?.profileImage).toBe(
      "https://cdn.example.com/profile-images/1/uuid",
    );
  });

  it("닉네임+이미지 둘 다 변경하면 PATCH body 에 둘 다 들어간다", async () => {
    let patchedBody: unknown = null;
    server.use(
      http.post(PRESIGNED_URL, () =>
        HttpResponse.json({
          data: { uploadUrl: S3_URL, key: "profile-images/1/uuid" },
          status: 200,
          message: "OK",
        }),
      ),
      http.put(S3_URL, () => new HttpResponse(null, { status: 200 })),
      http.patch(PROFILE_URL, async ({ request }) => {
        patchedBody = await request.json();
        return HttpResponse.json({
          data: { id: 1, nickname: "new", profileImage: "https://cdn/x" },
          status: 200,
          message: "OK",
        });
      }),
    );

    const file = new File([new Uint8Array(2)], "p.png", { type: "image/png" });
    const { result } = renderHook(() => useUpdateProfile(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ nickname: "new", file });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(patchedBody).toEqual({
      nickname: "new",
      profileImageKey: "profile-images/1/uuid",
    });
  });

  it("presigned 발급이 실패하면 PUT/PATCH 는 호출되지 않는다", async () => {
    let s3Calls = 0;
    let patchCalls = 0;
    server.use(
      http.post(PRESIGNED_URL, () =>
        HttpResponse.json(
          { data: null, status: 400, message: "INVALID_IMAGE_CONTENT_TYPE" },
          { status: 400 },
        ),
      ),
      http.put(S3_URL, () => {
        s3Calls += 1;
        return new HttpResponse(null, { status: 200 });
      }),
      http.patch(PROFILE_URL, () => {
        patchCalls += 1;
        return HttpResponse.json({ data: null, status: 200, message: "OK" });
      }),
    );

    const file = new File([new Uint8Array(2)], "p.png", { type: "image/png" });
    const { result } = renderHook(() => useUpdateProfile(), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync({ file })).rejects.toBeDefined();
    });

    expect(s3Calls).toBe(0);
    expect(patchCalls).toBe(0);
  });

  it("S3 PUT 이 실패하면 PATCH 는 호출되지 않는다", async () => {
    let patchCalls = 0;
    server.use(
      http.post(PRESIGNED_URL, () =>
        HttpResponse.json({
          data: { uploadUrl: S3_URL, key: "profile-images/1/uuid" },
          status: 200,
          message: "OK",
        }),
      ),
      http.put(S3_URL, () => new HttpResponse(null, { status: 403 })),
      http.patch(PROFILE_URL, () => {
        patchCalls += 1;
        return HttpResponse.json({ data: null, status: 200, message: "OK" });
      }),
    );

    const file = new File([new Uint8Array(2)], "p.png", { type: "image/png" });
    const { result } = renderHook(() => useUpdateProfile(), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync({ file })).rejects.toBeDefined();
    });

    expect(patchCalls).toBe(0);
  });

  it("nickname 도 file 도 없으면 mutation 자체가 실패한다", async () => {
    let patchCalls = 0;
    server.use(
      http.patch(PROFILE_URL, () => {
        patchCalls += 1;
        return HttpResponse.json({ data: null, status: 200, message: "OK" });
      }),
    );

    const { result } = renderHook(() => useUpdateProfile(), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync({})).rejects.toBeDefined();
    });

    expect(patchCalls).toBe(0);
  });
});
