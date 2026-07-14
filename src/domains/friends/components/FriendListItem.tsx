import { Avatar } from "@/components/Avatar";
import type { FriendItem } from "../types";

const WITHDRAWN_LABEL = "(탈퇴한 사용자)";

type Props = {
  item: FriendItem;
  onSelect: (userId: number) => void; // 프로필 모달 열기
  onRemove: (userId: number) => void; // 탈퇴 유저 등 프로필을 열 수 없을 때 바로 삭제
};

// 탈퇴 유저(nickname null)는 프로필을 열 수 없으므로 행 탭 대신 우측 "삭제"만 제공한다.
export function FriendListItem({ item, onSelect, onRemove }: Props) {
  const isWithdrawn = item.nickname === null;
  const name = item.nickname ?? WITHDRAWN_LABEL;

  if (isWithdrawn) {
    return (
      <div className="flex w-full items-center gap-3 px-5 py-3">
        <Avatar src={item.profileImage} name={name} size="sm" />
        <span className="flex-1 text-[15px] font-semibold text-gray-400">{name}</span>
        <button
          type="button"
          onClick={() => onRemove(item.userId)}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-[13px] font-semibold text-gray-500 active:bg-gray-100"
        >
          삭제
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(item.userId)}
      className="flex w-full items-center gap-3 px-5 py-3 text-left active:bg-gray-50"
    >
      <Avatar src={item.profileImage} name={name} size="sm" online={item.online} />
      <span className="text-[15px] font-semibold text-gray-800">{name}</span>
    </button>
  );
}
