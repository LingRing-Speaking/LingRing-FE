import { Avatar } from "@/components/Avatar";
import type { FriendItem } from "../types";

const WITHDRAWN_LABEL = "(탈퇴한 사용자)";

type Props = {
  item: FriendItem;
  onSelect: (userId: number) => void; // 프로필 탭 → 상세 모달
  onAccept: (userId: number) => void;
  onRemove: (userId: number) => void; // 받은 요청 거절 / 보낸 요청 취소 (같은 DELETE)
  actioning: boolean;
};

// 받은 요청은 [수락][거절], 보낸 요청은 "대기 중" + [취소].
// 프로필(아바타+닉네임) 탭 시 상대 상세 정보 모달을 연다(탈퇴 유저는 제외).
export function RequestListItem({ item, onSelect, onAccept, onRemove, actioning }: Props) {
  const name = item.nickname ?? WITHDRAWN_LABEL;
  const isReceived = item.direction === "RECEIVED";
  const canOpenProfile = item.nickname !== null;

  return (
    <div className="flex items-center gap-3 px-5 py-3">
      {canOpenProfile ? (
        <button
          type="button"
          onClick={() => onSelect(item.userId)}
          className="flex flex-1 items-center gap-3 text-left"
        >
          <Avatar src={item.profileImage} name={name} size="sm" />
          <span className="text-[15px] font-semibold text-gray-800">{name}</span>
        </button>
      ) : (
        <div className="flex flex-1 items-center gap-3">
          <Avatar src={item.profileImage} name={name} size="sm" />
          <span className="text-[15px] font-semibold text-gray-400">{name}</span>
        </div>
      )}

      {isReceived ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onAccept(item.userId)}
            disabled={actioning}
            className="rounded-lg bg-mint-500 px-3.5 py-1.5 text-[13px] font-bold text-white active:bg-mint-600 disabled:opacity-60"
          >
            수락
          </button>
          <button
            type="button"
            onClick={() => onRemove(item.userId)}
            disabled={actioning}
            className="rounded-lg border border-gray-200 px-3.5 py-1.5 text-[13px] font-semibold text-gray-500 active:bg-gray-100 disabled:opacity-60"
          >
            거절
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2.5">
          <span className="text-[12px] text-gray-400">대기 중</span>
          <button
            type="button"
            onClick={() => onRemove(item.userId)}
            disabled={actioning}
            className="rounded-lg border border-gray-200 px-3.5 py-1.5 text-[13px] font-semibold text-gray-500 active:bg-gray-100 disabled:opacity-60"
          >
            취소
          </button>
        </div>
      )}
    </div>
  );
}
