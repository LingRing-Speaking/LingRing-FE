import type { ReactNode } from "react";
import type { FriendRelation } from "../types";

// row: 검색 결과 행의 컴팩트 버튼(기본) · cta: 프로필 모달 하단 풀너비 버튼
type Variant = "row" | "cta";

type Props = {
  relation: FriendRelation;
  onAdd: () => void;
  onAccept: () => void;
  pending: boolean;
  variant?: Variant;
};

const CTA_BLOCK = "flex h-[52px] w-full items-center justify-center rounded-[14px] tracking-tight";

const PRIMARY: Record<Variant, string> = {
  row: "rounded-lg bg-mint-500 px-3.5 py-1.5 text-[13px] font-bold text-white active:bg-mint-600 disabled:opacity-60",
  cta: `${CTA_BLOCK} bg-mint-500 text-[16px] font-bold text-white active:bg-mint-600 disabled:opacity-60`,
};

const REQUEST_SENT: Record<Variant, string> = {
  row: "rounded-lg bg-gray-100 px-3.5 py-1.5 text-[13px] font-semibold text-gray-400",
  cta: `${CTA_BLOCK} bg-gray-100 text-[15px] font-semibold text-gray-400`,
};

const FRIEND: Record<Variant, string> = {
  row: "text-[13px] font-bold text-mint-600",
  cta: `${CTA_BLOCK} bg-mint-100 text-[15px] font-bold text-mint-600`,
};

// 검색 결과의 relation 에 따라 우측 액션을 그린다. (행·프로필 모달 양쪽에서 재사용)
export function RelationActionButton({
  relation,
  onAdd,
  onAccept,
  pending,
  variant = "row",
}: Props): ReactNode {
  switch (relation) {
    case "NONE":
      return (
        <button type="button" onClick={onAdd} disabled={pending} className={PRIMARY[variant]}>
          친구 추가
        </button>
      );
    case "REQUEST_RECEIVED":
      return (
        <button type="button" onClick={onAccept} disabled={pending} className={PRIMARY[variant]}>
          수락
        </button>
      );
    case "REQUEST_SENT":
      return <span className={REQUEST_SENT[variant]}>요청됨</span>;
    case "FRIEND":
      return <span className={FRIEND[variant]}>✓ 친구</span>;
    case "SELF":
      return <span className="text-[13px] font-semibold text-gray-400">(나)</span>;
    default:
      return null;
  }
}
