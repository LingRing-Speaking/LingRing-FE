import { RelationActionButton } from "@/domains/friends/components/RelationActionButton";
import { useAcceptFriendRequest } from "@/domains/friends/hooks/useAcceptFriendRequest";
import { useSendFriendRequest } from "@/domains/friends/hooks/useSendFriendRequest";
import { UserProfileModal } from "./UserProfileModal";

type Props = {
  partnerId: number | null;
  open: boolean;
  onClose: () => void;
  onReport: () => void;
  onBlock: () => void;
};

// 통화 상대 프로필 모달 — 공용 UserProfileModal 에 친구 추가·차단/신고 액션을 주입한 래퍼.
export function PartnerProfileModal({ partnerId, open, onClose, onReport, onBlock }: Props) {
  const sendMutation = useSendFriendRequest();
  const acceptMutation = useAcceptFriendRequest();
  const actioning = sendMutation.isPending || acceptMutation.isPending;

  return (
    <UserProfileModal
      userId={partnerId}
      open={open}
      onClose={onClose}
      actions={(profile) => (
        <>
          <div className="mt-2 flex justify-center py-2.5">
            <RelationActionButton
              relation={profile.relation}
              onAdd={() => sendMutation.mutate(profile.id)}
              onAccept={() => acceptMutation.mutate(profile.id)}
              pending={actioning}
            />
          </div>
          <div className="flex items-center justify-center gap-10 py-2.5">
            <button
              type="button"
              onClick={onBlock}
              className="text-[13px] font-semibold tracking-tight text-gray-700 underline underline-offset-[3px] active:opacity-60"
            >
              차단하기
            </button>
            <button
              type="button"
              onClick={onReport}
              className="text-[13px] font-semibold tracking-tight text-coral-600 underline underline-offset-[3px] active:opacity-60"
            >
              신고하기
            </button>
          </div>
        </>
      )}
    />
  );
}
