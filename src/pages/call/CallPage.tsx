import { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { PageShell } from "@/components/PageShell";
import { useUserId } from "@/domains/auth/hooks/useUserId";
import { useCallSession } from "@/domains/call/hooks/useCallSession";
import { useUserProfile } from "@/domains/user/hooks/useUserProfile";
import { CallTimer } from "./CallTimer";
import { EndConfirmSheet } from "./EndConfirmSheet";

export function CallPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const partnerId = (useLocation().state as { partnerId?: number } | null)?.partnerId;

  if (!roomId || partnerId == null) {
    return <Navigate to="/home" replace />;
  }

  return <CallPageInner roomId={roomId} partnerId={partnerId} />;
}

function CallPageInner({ roomId, partnerId }: { roomId: string; partnerId: number }) {
  const userId = useUserId();
  const navigate = useNavigate();
  const session = useCallSession({ userId, roomId, partnerId });
  const profile = useUserProfile(partnerId);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    if (session.status === "ended") navigate("/home", { replace: true });
  }, [session.status, navigate]);

  return (
    <PageShell>
      <main className="relative flex flex-1 flex-col overflow-hidden bg-gradient-to-b from-mint-50 to-white">
        {/* 항상 마운트되는 remote audio — status 분기 밖 */}
        <audio ref={session.remoteAudioRef} autoPlay className="hidden" />

        {session.status === "error" ? (
          <ErrorView message={session.errorMessage} onHome={() => navigate("/home")} />
        ) : (
          <CallView
            status={session.status}
            isMuted={session.isMuted}
            onMute={session.toggleMute}
            isSpeakerOn={session.isSpeakerOn}
            onSpeaker={session.toggleSpeaker}
            onEnd={() => setSheetOpen(true)}
            partnerId={partnerId}
            nickname={profile.data?.nickname ?? null}
            profileImage={profile.data?.profileImage ?? null}
          />
        )}

        <EndConfirmSheet
          open={sheetOpen}
          onKeep={() => setSheetOpen(false)}
          onEnd={() => {
            setSheetOpen(false);
            session.end();
          }}
        />
      </main>
    </PageShell>
  );
}

function CallView({
  status,
  isMuted,
  onMute,
  isSpeakerOn,
  onSpeaker,
  onEnd,
  partnerId,
  nickname,
  profileImage,
}: {
  status: "connecting" | "connected" | "ended";
  isMuted: boolean;
  onMute: () => void;
  isSpeakerOn: boolean;
  onSpeaker: () => void;
  onEnd: () => void;
  partnerId: number;
  nickname: string | null;
  profileImage: string | null;
}) {
  return (
    <>
      <div className="relative z-[2] flex flex-col items-center gap-2 px-5 pt-4">
        <CallTimer active={status === "connected"} />
      </div>

      <section className="relative z-[1] flex flex-1 flex-col items-center justify-center px-6">
        <div className="relative mb-1.5 flex h-60 w-60 items-center justify-center">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(31,191,146,0.18)_0%,rgba(31,191,146,0)_70%)] animate-halo"
          />
          <div className="relative flex h-40 w-40 items-center justify-center overflow-hidden rounded-full border-[3px] border-white bg-gradient-to-br from-mint-300 via-mint-500 to-coral-500 text-white shadow-orb">
            {profileImage ? (
              <img
                src={profileImage}
                alt="상대 프로필 이미지"
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="select-none text-[56px] font-bold tracking-[-0.02em] text-white">
                {nickname?.charAt(0) ?? String(partnerId).slice(-1)}
              </span>
            )}
          </div>
        </div>
        <p className="m-0 text-[26px] font-bold leading-tight tracking-[-0.02em] text-gray-900">
          {nickname ?? `상대 #${partnerId}`}
        </p>
        <p className="m-0 mt-1 inline-flex items-center justify-center gap-1.5 text-[14px] font-medium text-gray-600">
          <span
            aria-hidden="true"
            className={`inline-block h-1.5 w-1.5 rounded-full ${
              status === "connected" ? "bg-mint-500" : "bg-gray-400"
            }`}
          />
          {status === "connected" ? "연결됨" : "연결 중…"}
        </p>
      </section>

      <div className="relative z-[2] flex items-center justify-center gap-7 px-6 pb-9 pt-2">
        <button
          type="button"
          aria-label="음소거"
          aria-pressed={isMuted}
          onClick={onMute}
          className={`flex h-16 w-16 items-center justify-center rounded-full shadow-ctrl transition active:scale-95 ${
            isMuted ? "bg-gray-900 text-white" : "bg-white text-gray-800"
          }`}
        >
          <MicIcon muted={isMuted} />
        </button>
        <button
          type="button"
          aria-label="스피커"
          aria-pressed={isSpeakerOn}
          onClick={onSpeaker}
          className={`flex h-16 w-16 items-center justify-center rounded-full shadow-ctrl transition active:scale-95 ${
            isSpeakerOn ? "bg-gray-900 text-white" : "bg-white text-gray-800"
          }`}
        >
          <SpeakerIcon />
        </button>
        <button
          type="button"
          aria-label="통화 종료"
          onClick={onEnd}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-coral-500 text-white shadow-end transition active:scale-95"
        >
          <EndIcon />
        </button>
      </div>
    </>
  );
}

function ErrorView({ message, onHome }: { message: string | null; onHome: () => void }) {
  return (
    <div className="relative z-[1] flex flex-1 flex-col items-center justify-center gap-4 px-6">
      <p className="m-0 text-[15px] font-medium text-gray-700">
        {message ?? "통화 연결에 실패했어요"}
      </p>
      <button
        type="button"
        onClick={onHome}
        className="rounded-md border border-gray-300 px-5 py-2.5 text-[14px] font-semibold text-gray-700"
      >
        메인으로
      </button>
    </div>
  );
}

function MicIcon({ muted }: { muted: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <path d="M12 19v3" />
      {muted && <line data-testid="mic-slash" x1="4" y1="4" x2="20" y2="20" />}
    </svg>
  );
}

function SpeakerIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11 5 6 9H2v6h4l5 4V5Z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18.5 5.5a9 9 0 0 1 0 13" />
    </svg>
  );
}

function EndIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <g transform="rotate(135 12 12)">
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.72 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0 1 22 16.92z" />
      </g>
    </svg>
  );
}
