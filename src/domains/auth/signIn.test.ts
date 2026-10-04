import { describe, it, expect, beforeEach, vi } from "vitest";
import { ApiError } from "@/lib/http";
import {
  NicknameRetryExhaustedError,
  RejoinConfirmationRequiredError,
  confirmRejoin,
  signInWithApple,
  signInWithGoogle,
  signInWithKakao,
} from "./signIn";

vi.mock("./kakao", () => ({
  loginWithKakao: vi.fn(),
}));
vi.mock("./apple", () => ({
  loginWithApple: vi.fn(),
}));
vi.mock("./google", () => ({
  loginWithGoogle: vi.fn(),
}));
vi.mock("./api/socialLogin", () => ({
  postSocialLogin: vi.fn(),
}));

import { loginWithKakao } from "./kakao";
import { loginWithApple } from "./apple";
import { loginWithGoogle } from "./google";
import { postSocialLogin } from "./api/socialLogin";

const mockKakao = vi.mocked(loginWithKakao);
const mockApple = vi.mocked(loginWithApple);
const mockGoogle = vi.mocked(loginWithGoogle);
const mockApi = vi.mocked(postSocialLogin);

const SUCCESS_RESPONSE = {
  accessToken: "access-jwt",
  refreshToken: "refresh-jwt",
  user: { id: 1, nickname: "x-y-1234", profileImage: null },
};

describe("signInWithKakao", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockKakao.mockResolvedValue({ idToken: "id-jwt", accessToken: "access-jwt" });
  });

  it("happy path — 한 번에 성공하면 응답을 반환한다", async () => {
    mockApi.mockResolvedValueOnce(SUCCESS_RESPONSE);

    const result = await signInWithKakao();

    expect(result).toEqual(SUCCESS_RESPONSE);
    expect(mockApi).toHaveBeenCalledTimes(1);
    expect(mockApi.mock.calls[0]?.[0]).toMatchObject({
      provider: "kakao",
      idToken: "id-jwt",
      accessToken: "access-jwt",
    });
  });

  it("닉네임 충돌(409)이 반복되면 새 닉네임으로 재시도한다", async () => {
    mockApi
      .mockRejectedValueOnce(new ApiError(409, "nickname conflict"))
      .mockRejectedValueOnce(new ApiError(409, "nickname conflict"))
      .mockResolvedValueOnce(SUCCESS_RESPONSE);

    const result = await signInWithKakao();

    expect(result).toEqual(SUCCESS_RESPONSE);
    expect(mockApi).toHaveBeenCalledTimes(3);
    const nicknames = mockApi.mock.calls.map((call) => call[0].nickname);
    expect(new Set(nicknames).size).toBeGreaterThan(1);
  });

  it("재시도 한계 초과 시 NicknameRetryExhaustedError를 던진다", async () => {
    mockApi.mockRejectedValue(new ApiError(409, "nickname conflict"));

    await expect(signInWithKakao()).rejects.toBeInstanceOf(NicknameRetryExhaustedError);
  });

  it("409가 아닌 에러는 즉시 전파한다", async () => {
    mockApi.mockRejectedValueOnce(new ApiError(401, "invalid id token"));

    await expect(signInWithKakao()).rejects.toBeInstanceOf(ApiError);
    expect(mockApi).toHaveBeenCalledTimes(1);
  });
});

describe("signInWithApple", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockApple.mockResolvedValue({
      identityToken: "apple-id-jwt",
      authorizationCode: "apple-auth-code",
    });
  });

  it("happy path — provider=apple 과 identityToken·authorizationCode 로 호출한다 (accessToken 없음)", async () => {
    mockApi.mockResolvedValueOnce(SUCCESS_RESPONSE);

    const result = await signInWithApple();

    expect(result).toEqual(SUCCESS_RESPONSE);
    expect(mockApi).toHaveBeenCalledTimes(1);
    const payload = mockApi.mock.calls[0]?.[0];
    expect(payload).toMatchObject({
      provider: "apple",
      idToken: "apple-id-jwt",
      authorizationCode: "apple-auth-code",
    });
    expect(payload?.accessToken).toBeUndefined();
  });

  it("닉네임 충돌(409)이 반복되면 새 닉네임으로 재시도한다", async () => {
    mockApi
      .mockRejectedValueOnce(new ApiError(409, "nickname conflict"))
      .mockResolvedValueOnce(SUCCESS_RESPONSE);

    const result = await signInWithApple();

    expect(result).toEqual(SUCCESS_RESPONSE);
    expect(mockApi).toHaveBeenCalledTimes(2);
  });

  it("409가 아닌 에러는 즉시 전파한다", async () => {
    mockApi.mockRejectedValueOnce(new ApiError(401, "invalid identity token"));

    await expect(signInWithApple()).rejects.toBeInstanceOf(ApiError);
    expect(mockApi).toHaveBeenCalledTimes(1);
  });
});

describe("signInWithGoogle", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockGoogle.mockResolvedValue({ idToken: "google-id-jwt" });
  });

  it("happy path — provider=google 과 idToken 으로 호출한다 (accessToken 없음)", async () => {
    mockApi.mockResolvedValueOnce(SUCCESS_RESPONSE);

    const result = await signInWithGoogle();

    expect(result).toEqual(SUCCESS_RESPONSE);
    expect(mockApi).toHaveBeenCalledTimes(1);
    const payload = mockApi.mock.calls[0]?.[0];
    expect(payload).toMatchObject({
      provider: "google",
      idToken: "google-id-jwt",
    });
    expect(payload?.accessToken).toBeUndefined();
  });

  it("닉네임 충돌(409)이 반복되면 새 닉네임으로 재시도한다", async () => {
    mockApi
      .mockRejectedValueOnce(new ApiError(409, "nickname conflict"))
      .mockResolvedValueOnce(SUCCESS_RESPONSE);

    const result = await signInWithGoogle();

    expect(result).toEqual(SUCCESS_RESPONSE);
    expect(mockApi).toHaveBeenCalledTimes(2);
  });

  it("409가 아닌 에러는 즉시 전파한다", async () => {
    mockApi.mockRejectedValueOnce(new ApiError(401, "invalid id token"));

    await expect(signInWithGoogle()).rejects.toBeInstanceOf(ApiError);
    expect(mockApi).toHaveBeenCalledTimes(1);
  });
});

describe("재가입 확인 (REJOIN_CONFIRMATION_REQUIRED)", () => {
  const REJOIN_ERROR = new ApiError(
    409,
    "최근 탈퇴한 계정입니다. 재가입 여부를 확인해주세요.",
    "REJOIN_CONFIRMATION_REQUIRED",
  );

  beforeEach(() => {
    vi.resetAllMocks();
    mockGoogle.mockResolvedValue({ idToken: "google-id-jwt" });
  });

  it("재가입 확인이 필요하면 닉네임 재시도 없이 RejoinConfirmationRequiredError를 던진다", async () => {
    mockApi.mockRejectedValue(REJOIN_ERROR);

    await expect(signInWithGoogle()).rejects.toBeInstanceOf(RejoinConfirmationRequiredError);
    expect(mockApi).toHaveBeenCalledTimes(1);
  });

  it("confirmRejoin 은 소셜 로그인을 다시 띄우지 않고 같은 토큰에 rejoinConfirmed=true 를 붙여 재요청한다", async () => {
    mockApi.mockRejectedValueOnce(REJOIN_ERROR).mockResolvedValueOnce(SUCCESS_RESPONSE);

    const error = await signInWithGoogle().catch((err: unknown) => err);
    if (!(error instanceof RejoinConfirmationRequiredError)) throw error;
    const result = await confirmRejoin(error.pendingSignIn);

    expect(result).toEqual(SUCCESS_RESPONSE);
    expect(mockGoogle).toHaveBeenCalledTimes(1);
    expect(mockApi.mock.calls[1]?.[0]).toMatchObject({
      provider: "google",
      idToken: "google-id-jwt",
      rejoinConfirmed: true,
    });
  });

  it("재가입 재요청 중 닉네임 충돌(code=NICKNAME_CONFLICT)이면 새 닉네임으로 재시도한다", async () => {
    mockApi
      .mockRejectedValueOnce(new ApiError(409, "이미 사용 중인 닉네임입니다.", "NICKNAME_CONFLICT"))
      .mockResolvedValueOnce(SUCCESS_RESPONSE);

    const result = await confirmRejoin({ provider: "google", idToken: "google-id-jwt" });

    expect(result).toEqual(SUCCESS_RESPONSE);
    expect(mockApi).toHaveBeenCalledTimes(2);
    expect(mockApi.mock.calls[1]?.[0]).toMatchObject({ rejoinConfirmed: true });
  });
});
