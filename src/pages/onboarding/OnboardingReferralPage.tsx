import { Navigate, useNavigate } from "react-router-dom";
import { PageShell } from "@/components/PageShell";
import {
  REFERRAL_REDEEM_TITLE_ID,
  ReferralRedeemCard,
} from "@/domains/referral/components/ReferralRedeemCard";
import { useReferralStatus } from "@/domains/referral/hooks/useReferralStatus";

/**
 * 가입 온보딩의 마지막 단계(닉네임 설정 다음). 건너뛸 수 있고, 놓친 입력은 설정에서 할 수 있다.
 * 입력이 불가능한 유저(재가입자 등)나 상태 조회 실패 시에는 단계 자체를 건너뛴다.
 */
export function OnboardingReferralPage() {
  const navigate = useNavigate();
  const status = useReferralStatus();

  const shouldSkip = status.isError || status.data?.redeemable === false;
  if (shouldSkip) return <Navigate to="/home" replace />;

  return (
    <PageShell>
      <main className="relative flex flex-1 flex-col bg-gray-50">
        {status.data && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={REFERRAL_REDEEM_TITLE_ID}
            className="absolute inset-0 z-20 flex items-center justify-center px-6"
          >
            <div aria-hidden="true" className="absolute inset-0 bg-black/40" />
            <ReferralRedeemCard
              closeLabel="건너뛰기"
              onClose={() => navigate("/home", { replace: true })}
            />
          </div>
        )}
      </main>
    </PageShell>
  );
}
