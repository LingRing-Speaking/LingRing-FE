import { CountBadge } from "./CountBadge";

type Props = {
  count: number;
  onClick: () => void;
};

// 친구 목록 상단의 "친구 요청 N ›" 엔트리 카드. 받은 요청이 있을 때만 렌더한다.
export function ReceivedRequestCard({ count, onClick }: Props) {
  if (count <= 0) return null;

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
