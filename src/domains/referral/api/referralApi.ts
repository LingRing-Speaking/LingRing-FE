import { httpGet, httpPost } from "@/lib/http";
import type { RedeemReferralResult, ReferralStatus } from "../types";

export function fetchReferralStatus(): Promise<ReferralStatus> {
  return httpGet<ReferralStatus>("/me/referral");
}

export function redeemReferral(nickname: string): Promise<RedeemReferralResult> {
  return httpPost<RedeemReferralResult>("/me/referral/redeem", { nickname });
}
