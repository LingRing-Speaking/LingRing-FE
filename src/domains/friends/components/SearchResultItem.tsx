import { Avatar } from "@/components/Avatar";
import type { FriendSearchResult } from "../types";
import { RelationActionButton } from "./RelationActionButton";

type Props = {
  result: FriendSearchResult;
  onSelect: (userId: number) => void; // 프로필 모달 열기
  onAdd: () => void;
  onAccept: () => void;
  pending: boolean;
};

// 본인(SELF)은 프로필을 열 수 없으므로 행 탭 비활성 + "(나)" 표시.
export function SearchResultItem({ result, onSelect, onAdd, onAccept, pending }: Props) {
  const isSelf = result.relation === "SELF";

  return (
    <div className="flex items-center gap-3 px-5 py-3">
      {isSelf ? (
        <div className="flex flex-1 items-center gap-3">
          <Avatar src={result.profileImage} name={result.nickname} size="sm" />
          <span className="text-[15px] font-semibold text-gray-800">{result.nickname}</span>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => onSelect(result.userId)}
          className="flex flex-1 items-center gap-3 text-left"
        >
          <Avatar src={result.profileImage} name={result.nickname} size="sm" />
          <span className="text-[15px] font-semibold text-gray-800">{result.nickname}</span>
        </button>
      )}

      <RelationActionButton
        relation={result.relation}
        onAdd={onAdd}
        onAccept={onAccept}
        pending={pending}
      />
    </div>
  );
}
