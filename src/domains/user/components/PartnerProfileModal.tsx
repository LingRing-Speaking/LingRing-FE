import { useState } from "react";
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

// 통화 상대 프로필 모달 — 공용 UserProfileModal 에 친구 추가 CTA(하단)와
// 차단/신고 ⋯ 메뉴(좌상단)를 주입한 래퍼.
export function PartnerProfileModal({ partnerId, open, onClose, onReport, onBlock }: Props) {
  const sendMutation = useSendFriendRequest();
  const acceptMutation = useAcceptFriendRequest();
  const actioning = sendMutation.isPending || acceptMutation.isPending;

  return (
    <UserProfileModal
      userId={partnerId}
      open={open}
      onClose={onClose}
      headerAction={<PartnerOverflowMenu onBlock={onBlock} onReport={onReport} />}
      actions={(profile) => (
        <div className="mt-4">
          <RelationActionButton
            variant="cta"
            relation={profile.relation}
            onAdd={() => sendMutation.mutate(profile.id)}
            onAccept={() => acceptMutation.mutate(profile.id)}
            pending={actioning}
          />
        </div>
      )}
    />
  );
}

// 차단·신고는 빈도가 낮은 부정 액션이라 본문에 상시 노출하지 않고 ⋯ 뒤로 숨긴다.
// (인스타그램·당근 등 프로필 화면의 학습된 관례)
function PartnerOverflowMenu({ onBlock, onReport }: { onBlock: () => void; onReport: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);

  const select = (action: () => void) => {
    setMenuOpen(false);
    action();
  };

  return (
    <>
      <button
        type="button"
        aria-label="더보기"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((prev) => !prev)}
        className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 active:bg-gray-100"
      >
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="currentColor">
          <circle cx="5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>

      {menuOpen && (
        <>
          <div aria-hidden="true" onClick={() => setMenuOpen(false)} className="fixed inset-0" />
          <div
            role="menu"
            className="absolute left-0 top-[38px] min-w-[136px] overflow-hidden rounded-[14px] border border-gray-100 bg-white shadow-[0_8px_24px_rgba(0,0,0,0.14)]"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => select(onBlock)}
              className="flex w-full items-center px-[18px] py-3 text-left text-[14px] font-semibold tracking-tight text-gray-700 active:bg-gray-50"
            >
              차단하기
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => select(onReport)}
              className="flex w-full items-center border-t border-gray-50 px-[18px] py-3 text-left text-[14px] font-semibold tracking-tight text-coral-600 active:bg-gray-50"
            >
              신고하기
            </button>
          </div>
        </>
      )}
    </>
  );
}
