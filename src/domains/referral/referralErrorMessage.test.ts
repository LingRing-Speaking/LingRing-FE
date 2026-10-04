import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/http";
import { referralErrorMessage } from "./referralErrorMessage";

describe("referralErrorMessage", () => {
  it.each([
    ["REFERRER_NOT_FOUND", 404, "해당 닉네임의 사용자를 찾을 수 없어요."],
    ["REFERRAL_SELF_NOT_ALLOWED", 400, "내 닉네임은 입력할 수 없어요."],
    ["REFERRAL_ALREADY_REDEEMED", 409, "이미 추천인을 입력했어요."],
    ["REFERRAL_PERIOD_EXPIRED", 400, "추천인 입력 기간(가입 후 7일)이 지났어요."],
    ["REFERRAL_NOT_ELIGIBLE_REJOINED", 403, "다시 가입한 계정은 추천인을 입력할 수 없어요."],
  ])("%s 코드는 사유별 문구로 바꾼다", (code, status, expected) => {
    expect(referralErrorMessage(new ApiError(status, "server message", code))).toBe(expected);
  });

  it("알 수 없는 코드면 기본 문구를 돌려준다", () => {
    expect(referralErrorMessage(new ApiError(500, "boom", "INTERNAL_SERVER_ERROR"))).toBe(
      "잠시 후 다시 시도해주세요.",
    );
  });

  it("ApiError 가 아니면 기본 문구를 돌려준다", () => {
    expect(referralErrorMessage(new Error("boom"))).toBe("잠시 후 다시 시도해주세요.");
  });
});
