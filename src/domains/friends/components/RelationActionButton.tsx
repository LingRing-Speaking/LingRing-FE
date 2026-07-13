import type { ReactNode } from "react";
import type { FriendRelation } from "../types";

type Props = {
  relation: FriendRelation;
  onAdd: () => void;
  onAccept: () => void;
  pending: boolean;
};

const PRIMARY =
  "rounded-lg bg-mint-500 px-3.5 py-1.5 text-[13px] font-bold text-white active:bg-mint-600 disabled:opacity-60";

// 검색 결과의 relation 에 따라 우측 액션을 그린다. (행·프로필 모달 양쪽에서 재사용)
export function RelationActionButton({ relation, onAdd, onAccept, pending }: Props): ReactNode {
  switch (relation) {
    case "NONE":
      return (
        <button type="button" onClick={onAdd} disabled={pending} className={PRIMARY}>
          친구 추가
        </button>
      );
    case "REQUEST_RECEIVED":
      return (
        <button type="button" onClick={onAccept} disabled={pending} className={PRIMARY}>
          수락
        </button>
      );
    case "REQUEST_SENT":
      return (
        <span className="rounded-lg bg-gray-100 px-3.5 py-1.5 text-[13px] font-semibold text-gray-400">
          요청됨
        </span>
      );
    case "FRIEND":
      return <span className="text-[13px] font-bold text-mint-600">✓ 친구</span>;
    case "SELF":
      return <span className="text-[13px] font-semibold text-gray-400">(나)</span>;
    default:
      return null;
  }
}
