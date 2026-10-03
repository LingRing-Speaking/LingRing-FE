import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ANALYSIS_QUOTA_QUERY_KEY } from "@/domains/callHistory/hooks/useAnalysisQuota";
import { redeemReferral } from "../api/referralApi";
import type { RedeemReferralResult } from "../types";

/**
 * 추천인 닉네임을 입력해 황금티켓을 받는다. 성공 시 황금티켓 잔여가 바뀌므로
 * `["analysisQuota"]` 를 invalidate 한다.
 *
 * `["referral"]`(입력 가능 여부)는 여기서 invalidate 하지 않는다. 즉시 갱신하면
 * redeemable 이 false 로 뒤집히며 입력 화면이 닫혀, 성공·실패 안내를 보기 전에
 * 사라진다. 갱신은 사용자가 화면을 닫는 시점에 호출처가 맡는다.
 */
export function useRedeemReferral() {
  const queryClient = useQueryClient();

  return useMutation<RedeemReferralResult, Error, string>({
    mutationFn: (nickname) => redeemReferral(nickname),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ANALYSIS_QUOTA_QUERY_KEY });
    },
  });
}
