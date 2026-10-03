import { useState } from "react";
import { useRedeemReferral } from "../hooks/useRedeemReferral";
import { referralErrorMessage } from "../referralErrorMessage";

// 호출처의 dialog 가 aria-labelledby 로 가리킬 제목 id.
export const REFERRAL_REDEEM_TITLE_ID = "referral-redeem-title";

// 입력자·추천인 각각 받는 황금티켓 수 (BE 정책).
const REWARD_TICKET_COUNT = 3;

interface ReferralRedeemCardProps {
  /** 입력하지 않고 닫는 버튼의 라벨 (온보딩 "건너뛰기", 설정 "닫기"). */
  closeLabel: string;
  /** 건너뛰기·닫기, 그리고 지급 안내의 확인 모두 이 콜백으로 닫는다. */
  onClose: () => void;
}

/**
 * 추천인 닉네임 입력 카드. 오버레이·dialog 래퍼는 호출처(온보딩 페이지, 설정 모달)가 감싼다.
 */
export function ReferralRedeemCard({ closeLabel, onClose }: ReferralRedeemCardProps) {
  const [isRedeemed, setIsRedeemed] = useState(false);

  return (
    <div className="relative w-full max-w-[320px] rounded-[20px] bg-white p-6 shadow-ctrl">
      {isRedeemed ? (
        <RedeemSuccess onConfirm={onClose} />
      ) : (
        <RedeemForm
          closeLabel={closeLabel}
          onClose={onClose}
          onRedeemed={() => setIsRedeemed(true)}
        />
      )}
    </div>
  );
}

function RedeemForm({
  closeLabel,
  onClose,
  onRedeemed,
}: ReferralRedeemCardProps & { onRedeemed: () => void }) {
  const redeem = useRedeemReferral();
  const [nickname, setNickname] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);

  // 닉네임 규칙(validateNickname)은 적용하지 않는다. 규칙 도입 전 FE 가 랜덤 생성한
  // 닉네임(예: brave-tiger-1234)도 유효한 추천인이라, 판정은 서버에 맡긴다.
  const trimmedNickname = nickname.trim();
  const canSubmit = trimmedNickname.length > 0 && !redeem.isPending;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setSubmitError(null);
    try {
      await redeem.mutateAsync(trimmedNickname);
      onRedeemed();
    } catch (err) {
      setSubmitError(referralErrorMessage(err));
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h1
        id={REFERRAL_REDEEM_TITLE_ID}
        className="text-center text-[17px] font-bold leading-tight tracking-tight text-gray-900"
      >
        추천인이 있나요?
      </h1>
      <p className="mt-2 text-center text-[13.5px] font-medium leading-relaxed tracking-tight text-gray-500">
        친구의 닉네임을 입력하면
        <br />
        나와 친구 모두 황금티켓 {REWARD_TICKET_COUNT}장을 받아요.
      </p>

      <div className="mt-5">
        <label
          htmlFor="referral-nickname-input"
          className="mb-1.5 block text-[13px] font-medium text-gray-700"
        >
          추천인 닉네임
        </label>
        <input
          id="referral-nickname-input"
          type="text"
          value={nickname}
          onChange={(e) => {
            setNickname(e.target.value);
            setSubmitError(null);
          }}
          disabled={redeem.isPending}
          placeholder="친구의 닉네임"
          className="w-full rounded-[12px] border border-gray-200 px-3.5 py-2.5 text-[15px] tracking-tight text-gray-900 outline-none focus:border-mint-500 disabled:bg-gray-50"
        />
      </div>

      {submitError && (
        <p role="alert" className="mt-3 text-center text-[13px] font-medium text-coral-600">
          {submitError}
        </p>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="mt-5 w-full rounded-[14px] bg-mint-500 py-3.5 text-[15px] font-bold tracking-tight text-white transition-transform active:scale-[0.98] disabled:bg-gray-200 disabled:text-gray-400"
      >
        {redeem.isPending ? "확인 중..." : "입력하기"}
      </button>
      <button
        type="button"
        onClick={onClose}
        disabled={redeem.isPending}
        className="mt-2 w-full py-2.5 text-[14px] font-medium tracking-tight text-gray-500 disabled:opacity-50"
      >
        {closeLabel}
      </button>
    </form>
  );
}

function RedeemSuccess({ onConfirm }: { onConfirm: () => void }) {
  return (
    <>
      <h1
        id={REFERRAL_REDEEM_TITLE_ID}
        className="text-center text-[17px] font-bold leading-tight tracking-tight text-gray-900"
      >
        황금티켓 {REWARD_TICKET_COUNT}장을 받았어요
      </h1>
      <p className="mt-2 text-center text-[13.5px] font-medium leading-relaxed tracking-tight text-gray-500">
        추천인에게도 황금티켓 {REWARD_TICKET_COUNT}장을 보냈어요.
        <br />
        통화 분석에 사용해보세요.
      </p>
      <button
        type="button"
        onClick={onConfirm}
        autoFocus
        className="mt-5 w-full rounded-[14px] bg-mint-500 py-3.5 text-[15px] font-bold tracking-tight text-white transition-transform active:scale-[0.98]"
      >
        확인
      </button>
    </>
  );
}
