import { Avatar } from "@/components/Avatar";
import type { BlockedUser } from "@/domains/block/types";

const DATE_FORMATTER = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function formatBlockedAt(createdAt: string): string {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "";
  return `${DATE_FORMATTER.format(date).replace(/\.\s?/g, ".").replace(/\.$/, "")} 차단`;
}

type Props = {
  user: BlockedUser;
  onUnblock: (target: { id: number; nickname: string }) => void;
};

export function BlockedUserItem({ user, onUnblock }: Props) {
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <Avatar
        src={user.profileImage}
        name={user.nickname}
        size="sm"
        alt={`${user.nickname} 프로필 이미지`}
      />
      <div className="flex flex-1 flex-col">
        <span className="text-[15px] font-semibold tracking-tight text-gray-900">
          {user.nickname}
        </span>
        <span className="mt-0.5 text-[12.5px] font-medium tracking-tight text-gray-500">
          {formatBlockedAt(user.createdAt)}
        </span>
      </div>
      <button
        type="button"
        onClick={() => onUnblock({ id: user.blockedUserId, nickname: user.nickname })}
        className="text-[13px] font-semibold tracking-tight text-coral-600 active:opacity-60"
      >
        해제
      </button>
    </li>
  );
}
