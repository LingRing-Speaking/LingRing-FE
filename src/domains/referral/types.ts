export interface ReferralStatus {
  /** 미입력 · 가입 후 7일 이내 · 재가입자 아님 을 모두 만족할 때만 true. */
  redeemable: boolean;
  /** 가입 시각 + 7일. 오프셋 없는 LocalDateTime(KST 해석). 기간이 지나도 항상 내려온다. */
  redeemableUntil: string;
}

export interface RedeemReferralResult {
  /** 지급 후 입력자의 황금티켓 수. */
  paidTicket: number;
}
