import { CountBadge } from "./CountBadge";

type Props = {
  count: number; // 받은 요청 개수(뱃지용). 0 이면 뱃지는 숨지만 카드 자체는 렌더된다.
  onClick: () => void;
};

// 친구 목록 상단의 "친구 요청 ›" 엔트리 카드. 받은/보낸 요청 페이지로 가는 입구다.
// 노출 여부(받은 또는 보낸 요청 존재)는 호출처가 판단하고, 여기서는 뱃지만 개수로 그린다.
export function FriendRequestsCard({ count, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mx-5 mb-2 mt-3 flex items-center justify-between rounded-xl border border-mint-100 bg-mint-50 px-4 py-3 active:bg-mint-100"
    >
      <span className="text-[14px] font-bold text-mint-600">👥 친구 요청</span>
      <span className="flex items-center gap-2">
        <CountBadge count={count} />
        <span className="text-gray-400">›</span>
      </span>
    </button>
  );
}
