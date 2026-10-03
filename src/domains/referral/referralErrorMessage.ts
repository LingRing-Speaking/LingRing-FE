import { ApiError } from "@/lib/http";

const FALLBACK_MESSAGE = "잠시 후 다시 시도해주세요.";

// POST /me/referral/redeem 실패 사유(BE ErrorCode) → 사용자 문구.
const MESSAGE_BY_CODE: Record<string, string> = {
  REFERRER_NOT_FOUND: "해당 닉네임의 사용자를 찾을 수 없어요.",
  REFERRAL_SELF_NOT_ALLOWED: "내 닉네임은 입력할 수 없어요.",
  REFERRAL_ALREADY_REDEEMED: "이미 추천인을 입력했어요.",
  REFERRAL_PERIOD_EXPIRED: "추천인 입력 기간(가입 후 7일)이 지났어요.",
  REFERRAL_NOT_ELIGIBLE_REJOINED: "다시 가입한 계정은 추천인을 입력할 수 없어요.",
};

export function referralErrorMessage(err: unknown): string {
  if (!(err instanceof ApiError) || err.code === null) return FALLBACK_MESSAGE;
  return MESSAGE_BY_CODE[err.code] ?? FALLBACK_MESSAGE;
}
