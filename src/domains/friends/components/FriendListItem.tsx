import { Avatar } from "@/components/Avatar";
import type { FriendItem } from "../types";

const WITHDRAWN_LABEL = "(탈퇴한 사용자)";

type Props = {
  item: FriendItem;
  onSelect: (userId: number) => void; // 프로필 모달 열기
  onRemove: (userId: number) => void; // 탈퇴 유저 등 프로필을 열 수 없을 때 바로 삭제
  onCall?: (userId: number) => void; // 친구 지목 통화 걸기 (#213). online 친구에게만 노출
};

// 탈퇴 유저(nickname null)는 프로필을 열 수 없으므로 행 탭 대신 우측 "삭제"만 제공한다.
export function FriendListItem({ item, onSelect, onRemove, onCall }: Props) {
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

  // 통화 버튼이 행 버튼 안에 중첩되면 invalid HTML 이라 행 탭 영역과 나란히 배치한다.
  return (
    <div className="flex w-full items-center gap-3 px-5 py-3">
      <button
        type="button"
        onClick={() => onSelect(item.userId)}
        className="flex flex-1 items-center gap-3 text-left active:bg-gray-50"
      >
        <Avatar src={item.profileImage} name={name} size="sm" online={item.online} />
        <span className="text-[15px] font-semibold text-gray-800">{name}</span>
      </button>
      {onCall && item.online && (
        <button
          type="button"
          aria-label={`${name}에게 통화 걸기`}
          onClick={() => onCall(item.userId)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-mint-100 text-mint-600 active:bg-mint-200"
        >
          <PhoneIcon />
        </button>
      )}
    </div>
  );
}

function PhoneIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.72 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}
