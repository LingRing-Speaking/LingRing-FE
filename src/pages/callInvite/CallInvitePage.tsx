import { useEffect, useRef } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { Avatar } from "@/components/Avatar";
import { PageShell } from "@/components/PageShell";
import { cancelOutgoingInvitation } from "@/domains/matching/api/callInvitationApi";
import { useCreateCallInvitation } from "@/domains/matching/hooks/useCreateCallInvitation";
import { useOutgoingInvitation } from "@/domains/matching/hooks/useOutgoingInvitation";
import { useUserProfile } from "@/domains/user/hooks/useUserProfile";

/**
 * 친구 지목 통화 발신 화면 (#213). 진입 즉시 초대를 만들고 1초 폴링으로 결과를
 * 기다린다. 수락되면 랜덤 매칭과 동일한 계약(/call/:roomId + state)으로 통화
 * 화면에 진입하고, 거절·무응답(30초 TTL 만료)은 결과 안내로 끝난다.
 */
export function CallInvitePage() {
  const { inviteeId } = useParams<{ inviteeId: string }>();
  const inviteeUserId = Number(inviteeId);

  if (!Number.isInteger(inviteeUserId) || inviteeUserId <= 0) {
    return <Navigate to="/friends" replace />;
  }

  return <CallInvitePageInner inviteeUserId={inviteeUserId} />;
}

function CallInvitePageInner({ inviteeUserId }: { inviteeUserId: number }) {
  const navigate = useNavigate();
  const create = useCreateCallInvitation();
  const status = useOutgoingInvitation(create.isSuccess);
  const profile = useUserProfile(inviteeUserId);

  // 벨이 살아있는 동안에만 true — 이탈 시 cleanup 이 초대를 취소해 상대 벨을 멈춘다.
  const ringingRef = useRef(false);

  useEffect(() => {
    create.mutate(inviteeUserId, {
      onSuccess: () => {
        ringingRef.current = true;
      },
    });
    return () => {
      if (ringingRef.current) {
        cancelOutgoingInvitation().catch(() => {});
      }
    };
    // mount 시 1회만 실행. create.mutate 는 stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const data = status.data;
    if (data?.status === "ACCEPTED" && data.roomId) {
      ringingRef.current = false;
      navigate(`/call/${data.roomId}`, {
        state: { partnerId: inviteeUserId, callId: data.callId },
        replace: true,
      });
      return;
    }
    // 거절·만료가 관측되면 초대는 서버에서 이미 소멸 — 이탈 시 취소를 보낼 필요 없다.
    if (data?.status === "DECLINED" || data?.status === "NONE") {
      ringingRef.current = false;
    }
  }, [status.data, navigate, inviteeUserId]);

  const handleGoFriends = () => navigate("/friends");

  const nickname = profile.data?.nickname ?? null;

  const view = (() => {
    if (create.isError) return "unavailable";
    if (status.data?.status === "DECLINED") return "declined";
    if (status.data?.status === "NONE") return "noAnswer";
    return "ringing";
  })();

  return (
    <PageShell>
      <main className="relative flex flex-1 flex-col overflow-hidden bg-gradient-to-b from-mint-50 to-white">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 -top-[70px] z-0 h-[280px] w-[280px] rounded-full bg-mint-200 opacity-35 blur-[60px]"
        />

        {view === "ringing" && (
          <RingingView
            inviteeUserId={inviteeUserId}
            nickname={nickname}
            profileImage={profile.data?.profileImage ?? null}
            onCancel={handleGoFriends}
          />
        )}
        {view === "unavailable" && (
          <ResultView message="지금은 통화를 연결할 수 없어요" onGoFriends={handleGoFriends} />
        )}
        {view === "declined" && (
          <ResultView message="상대방이 통화를 거절했어요" onGoFriends={handleGoFriends} />
        )}
        {view === "noAnswer" && (
          <ResultView message="응답이 없어요" onGoFriends={handleGoFriends} />
        )}
      </main>
    </PageShell>
  );
}

function RingingView({
  inviteeUserId,
  nickname,
  profileImage,
  onCancel,
}: {
  inviteeUserId: number;
  nickname: string | null;
  profileImage: string | null;
  onCancel: () => void;
}) {
  return (
    <div className="relative z-[1] flex flex-1 flex-col items-center justify-center px-6">
      <div className="relative mb-4 flex h-52 w-52 items-center justify-center">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(31,191,146,0.18)_0%,rgba(31,191,146,0)_70%)] animate-halo"
        />
        <Avatar
          src={profileImage}
          name={nickname ?? String(inviteeUserId)}
          size="xl"
          alt="상대 프로필 이미지"
          className="relative border-[3px] border-white shadow-orb"
        />
      </div>
      <p className="m-0 text-[24px] font-bold leading-tight tracking-[-0.02em] text-gray-900">
        {nickname ?? `상대 #${inviteeUserId}`}
      </p>
      <p className="m-0 mt-2 text-[15px] font-medium text-gray-600">통화를 거는 중…</p>

      <div className="absolute inset-x-0 bottom-9 flex justify-center">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-5 py-3.5 text-[14px] font-semibold leading-none tracking-[-0.01em] text-gray-500 active:bg-gray-100 active:text-gray-700"
        >
          취소
        </button>
      </div>
    </div>
  );
}

function ResultView({ message, onGoFriends }: { message: string; onGoFriends: () => void }) {
  return (
    <div className="relative z-[1] flex flex-1 flex-col items-center justify-center gap-4 px-6">
      <p className="m-0 text-[15px] font-medium text-gray-700">{message}</p>
      <button
        type="button"
        onClick={onGoFriends}
        className="rounded-md border border-gray-300 px-5 py-2.5 text-[14px] font-semibold text-gray-700"
      >
        친구 목록으로
      </button>
    </div>
  );
}
