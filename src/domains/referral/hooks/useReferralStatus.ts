import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { fetchReferralStatus } from "../api/referralApi";
import type { ReferralStatus } from "../types";

export const REFERRAL_STATUS_QUERY_KEY = ["referral"] as const;

export function useReferralStatus(): UseQueryResult<ReferralStatus, Error> {
  return useQuery({
    queryKey: REFERRAL_STATUS_QUERY_KEY,
    queryFn: fetchReferralStatus,
  });
}
