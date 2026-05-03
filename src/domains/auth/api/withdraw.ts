import { httpPost } from "@/lib/http";

export type WithdrawalReason =
  | "NO_GOOD_MATCH"
  | "NO_PROGRESS"
  | "BUGGY"
  | "RARELY_USE"
  | "MISSING_FEATURE"
  | "OTHER";

export interface WithdrawPayload {
  reason: WithdrawalReason;
  // reason이 OTHER일 때만 자유 입력 사유. 다른 reason에서는 키 자체를 생략한다.
  description?: string;
}

// 회원탈퇴는 hard-delete. 성공(204) 시 BE에서 사용자 데이터·세션 모두 영구 삭제.
export function withdraw(payload: WithdrawPayload): Promise<void> {
  return httpPost<void>("/me/withdraw", payload);
}
