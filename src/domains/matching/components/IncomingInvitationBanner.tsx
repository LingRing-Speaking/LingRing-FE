import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar } from "@/components/Avatar";
import { useUserProfile } from "@/domains/user/hooks/useUserProfile";
import { acceptCallInvitation, declineCallInvitation } from "../api/callInvitationApi";
import { useIncomingInvitationStore } from "../incomingInvitationStore";
import type { IncomingInvitation } from "../types";

// 발신자 닉네임 조회가 끝나기 전 잠깐 보여줄 대체 표기.
const FALLBACK_INVITER_NAME = "친구";

/**
 * 수신 통화 초대 배너 (#213). 앱 전역(App 최상단, 라우터 안)에 한 번만 마운트한다.
 * 소리·진동 없이 메시지 형식으로만 알리며, 어느 화면 위에서든 뜬다 — 통화 중에도
 * 표시되고, 받으면 기존 통화 화면이 새 방으로 전환되며 이전 통화는 끊긴다.
 * 초대의 등장/소멸은 하트비트가 스토어에 반영한 것을 그대로 따른다.
 */
export function IncomingInvitationBanner() {
  const invitation = useIncomingInvitationStore((state) => state.invitation);

  if (!invitation) return null;

  // 초대가 바뀌면(다른 발신자·다른 시각) 응답 중 상태를 리셋하기 위해 key 로 리마운트한다.
  return (
    <BannerContent
      key={`${invitation.inviterId}-${invitation.deadline}`}
      invitation={invitation}
    />
  );
}

function BannerContent({ invitation }: { invitation: IncomingInvitation }) {
  const navigate = useNavigate();
  const setInvitation = useIncomingInvitationStore((state) => state.setInvitation);
  const profile = useUserProfile(invitation.inviterId);
  const [isResponding, setIsResponding] = useState(false);

  // 하트비트(≤5초 지연)를 보완하는 로컬 만료 — deadline 이 지나면 스스로 닫는다.
  useEffect(() => {
    const remainingMs = new Date(invitation.deadline).getTime() - Date.now();
    if (remainingMs <= 0) {
      setInvitation(null);
      return;
    }
    const timerId = window.setTimeout(() => setInvitation(null), remainingMs);
    return () => window.clearTimeout(timerId);
  }, [invitation, setInvitation]);

  const nickname = profile.data?.nickname ?? FALLBACK_INVITER_NAME;

  const handleAccept = async () => {
    if (isResponding) return;
    setIsResponding(true);
    try {
      const { roomId, callId } = await acceptCallInvitation();
      setInvitation(null);
      navigate(`/call/${roomId}`, { state: { partnerId: invitation.inviterId, callId } });
    } catch {
      // 초대가 이미 소멸(만료·발신 취소, 404) — 배너만 닫는다.
      setInvitation(null);
    }
  };

  const handleDecline = async () => {
    if (isResponding) return;
    setIsResponding(true);
    try {
      await declineCallInvitation();
    } catch {
      // 초대가 이미 소멸(404)해도 닫기만 하면 된다.
    }
    setInvitation(null);
  };

  return (
    <div
      role="alert"
      className="fixed inset-x-0 top-0 z-50 px-4 pt-[calc(env(safe-area-inset-top)+10px)]"
    >
      <div className="mx-auto flex w-full max-w-[400px] items-center gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.16)]">
        <Avatar
          src={profile.data?.profileImage ?? null}
          name={nickname}
          size="sm"
          alt="발신자 프로필 이미지"
        />
        <p className="m-0 flex-1 text-[14px] font-medium leading-snug text-gray-800">
          <span className="font-bold">{nickname}</span>
          님이 통화를 걸었어요
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={handleDecline}
            disabled={isResponding}
            className="rounded-xl bg-gray-100 px-3.5 py-2 text-[13px] font-semibold text-gray-600 active:bg-gray-200 disabled:opacity-50"
          >
            거절
          </button>
          <button
            type="button"
            onClick={handleAccept}
            disabled={isResponding}
            className="rounded-xl bg-mint-500 px-3.5 py-2 text-[13px] font-semibold text-white active:bg-mint-600 disabled:opacity-50"
          >
            받기
          </button>
        </div>
      </div>
    </div>
  );
}
