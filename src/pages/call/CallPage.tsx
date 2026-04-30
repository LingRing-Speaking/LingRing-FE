import { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { PageShell } from "@/components/PageShell";
import { env } from "@/config/env";
import { useCallSession } from "@/domains/call/hooks/useCallSession";
import { CallTimer } from "./CallTimer";
import { EndConfirmSheet } from "./EndConfirmSheet";

export function CallPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const partnerId = (useLocation().state as { partnerId?: number } | null)?.partnerId;

  if (!roomId || partnerId == null) {
    return <Navigate to="/" replace />;
  }

  return <CallPageInner roomId={roomId} partnerId={partnerId} />;
}

function CallPageInner({ roomId, partnerId }: { roomId: string; partnerId: number }) {
  const userId = env.devUserId;
  const navigate = useNavigate();
  const session = useCallSession({ userId, roomId, partnerId });
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    if (session.status === "ended") navigate("/", { replace: true });
  }, [session.status, navigate]);

  return (
    <PageShell>
      <main className="relative flex flex-1 flex-col overflow-hidden bg-gradient-to-b from-mint-50 to-white">
        {/* 항상 마운트되는 remote audio — status 분기 밖 */}
        <audio ref={session.remoteAudioRef} autoPlay className="hidden" />

        {session.status === "error" ? (
          <ErrorView message={session.errorMessage} onHome={() => navigate("/")} />
        ) : (
          <CallView
            status={session.status}
            isMuted={session.isMuted}
            onMute={session.toggleMute}
            onEnd={() => setSheetOpen(true)}
            partnerId={partnerId}
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
  onEnd,
  partnerId,
}: {
  status: "connecting" | "connected" | "ended";
  isMuted: boolean;
  onMute: () => void;
  onEnd: () => void;
  partnerId: number;
}) {
  return (
    <>
      <div className="relative z-[2] flex flex-col items-center gap-2 px-5 pt-4">
        <CallTimer active={status === "connected"} />
        <p className="m-0 text-[13px] font-medium text-gray-600">
          {status === "connecting" ? "연결 중…" : `상대 #${partnerId}`}
        </p>
      </div>

      <section className="relative z-[1] flex flex-1 flex-col items-center justify-center px-6">
        <div className="relative mb-6 flex h-60 w-60 items-center justify-center">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(31,191,146,0.18)_0%,rgba(31,191,146,0)_70%)] animate-halo"
          />
          <div className="relative flex h-40 w-40 items-center justify-center overflow-hidden rounded-full border-[3px] border-white bg-gradient-to-br from-mint-300 via-mint-500 to-coral-500 text-white shadow-orb">
            <span className="select-none text-[56px] font-bold tracking-[-0.02em] text-white">
              {String(partnerId).slice(-1)}
            </span>
          </div>
        </div>
      </section>

      <div className="relative z-[2] flex items-center justify-center gap-7 px-6 pb-9 pt-2">
        <button
          type="button"
          aria-label="음소거"
          onClick={onMute}
          className={`flex h-16 w-16 items-center justify-center rounded-full shadow-ctrl transition active:scale-95 ${
            isMuted ? "bg-gray-900 text-white" : "bg-white text-gray-800"
          }`}
        >
          <MicIcon />
        </button>
        <button
          type="button"
          aria-label="스피커"
          disabled
          className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-gray-400 shadow-ctrl"
          title="추후 지원 예정"
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

function MicIcon() {
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
