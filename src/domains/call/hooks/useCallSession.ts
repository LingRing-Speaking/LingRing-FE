import { useEffect, useRef, useState } from "react";
import { env } from "@/config/env";
import {
  configureCallAudioRoute,
  endCallAudioRoute,
  setSpeakerphone,
} from "@/lib/native/audioRoute";
import type { ServerMessage, IceCandidatePayload } from "../signaling/types";
import { createSignalingClient, type SignalingClient } from "../signaling/wsClient";
import { createPeerSession, type PeerSession } from "../webrtc/peerConnection";

export type CallStatus = "connecting" | "connected" | "ended" | "error";

/**
 * 통화가 끝난 이유. 종료 화면 헤드라인 분기에 쓰인다.
 * - self: 내가 종료 버튼으로 끊음
 * - peer: 상대가 HANGUP 을 보냄
 * - dropped: HANGUP 없이 연결이 끊김
 * - timeout: 20분 상한 도달로 자동 종료
 */
export type EndReason = "self" | "peer" | "dropped" | "timeout";

const PERMISSION_DENIED_MESSAGE = "마이크 권한이 필요해요";
const CONNECTION_FAILED_MESSAGE = "통화 연결에 실패했어요";

export type UseCallSessionOptions = {
  userId: number;
  roomId: string;
  partnerId: number;
};

export type UseCallSessionResult = {
  status: CallStatus;
  errorMessage: string | null;
  endReason: EndReason | null;
  isMuted: boolean;
  toggleMute: () => void;
  isSpeakerOn: boolean;
  toggleSpeaker: () => void;
  end: (reason?: EndReason) => void;
  remoteAudioRef: React.RefObject<HTMLAudioElement>;
  // 녹음(Android web 경로)이 로컬 마이크 스트림을 가져갈 수 있도록 노출.
  getLocalStream: () => MediaStream | null;
};

export function useCallSession(opts: UseCallSessionOptions): UseCallSessionResult {
  const [status, setStatus] = useState<CallStatus>("connecting");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [endReason, setEndReason] = useState<EndReason | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  // 첫 진입은 이어피스 default — RTCAudioSession 의 mode .voiceChat 자연 default 와 일치.
  // 정책 근거: memory project_call_audio_routing. 방안 3 (#84) 의 native libwebrtc 도입으로
  // 이어피스 default + 사용자 토글 양방향 + 마이크 안정 모두 만족 가능해짐.
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  const peerRef = useRef<PeerSession | null>(null);
  const wsRef = useRef<SignalingClient | null>(null);
  const cleanedUpRef = useRef(false);

  const cleanup = () => {
    if (cleanedUpRef.current) return;
    cleanedUpRef.current = true;
    peerRef.current?.close();
    wsRef.current?.close();
    void endCallAudioRoute().catch(() => {
      // 네이티브 audio session 해제 실패는 무시 — 앱 라이프사이클이 정리해줌
    });
  };

  const setError = (msg: string) => {
    if (cleanedUpRef.current) return;
    cleanup();
    setErrorMessage(msg);
    setStatus("error");
  };

  const finishEnded = (reason: EndReason) => {
    cleanup();
    setEndReason(reason);
    setStatus("ended");
  };

  useEffect(() => {
    let cancelled = false;
    // StrictMode dev: 1차 cleanup이 남긴 stale true를 2차 setup에서 리셋
    cleanedUpRef.current = false;

    const peer = createPeerSession({
      onLocalIce: (c: IceCandidatePayload) => {
        wsRef.current?.send({ type: "ICE_CANDIDATE", payload: c });
      },
      onRemoteTrack: (stream) => {
        const el = remoteAudioRef.current;
        if (!el) return;
        el.srcObject = stream;
        void el.play().catch(() => {
          // iOS 자동재생 정책에 막힐 수 있음 — known issue, spec 참조
        });
      },
      onConnectionStateChange: (s) => {
        if (s === "connected") {
          setStatus("connected");
          // WebKit RTC 의 모든 startup reconfig 가 끝난 시점이라 여기서 카테고리/라우팅을 정상화.
          // peer.start() 직후 (= getUserMedia 직후) 는 connection establishment 시점에 한 번 더
          // reconfig 되므로 reset 됨. saghul: "after stream establishment" 권장과 일치.
          void configureCallAudioRoute().catch(() => {
            // 네이티브 라우팅 셋업 실패는 UI 에 영향 안 주고 무시
          });
        } else if (s === "failed") {
          setError(CONNECTION_FAILED_MESSAGE);
        }
      },
    });
    peerRef.current = peer;

    const ws = createSignalingClient({
      userId: opts.userId,
      roomId: opts.roomId,
      baseUrl: env.wsBaseUrl,
    });
    wsRef.current = ws;

    const handleMessage = async (msg: ServerMessage) => {
      try {
        switch (msg.type) {
          case "READY": {
            if (msg.payload.callerUserId === opts.userId) {
              const sdp = await peer.createOffer();
              ws.send({ type: "OFFER", payload: { sdp } });
            }
            break;
          }
          case "OFFER": {
            const sdp = await peer.acceptOffer(msg.payload.sdp);
            ws.send({ type: "ANSWER", payload: { sdp } });
            break;
          }
          case "ANSWER": {
            await peer.acceptAnswer(msg.payload.sdp);
            break;
          }
          case "ICE_CANDIDATE": {
            await peer.addRemoteIce(msg.payload);
            break;
          }
          case "HANGUP": {
            finishEnded("peer");
            break;
          }
          case "ERROR": {
            setError(msg.payload.message || CONNECTION_FAILED_MESSAGE);
            break;
          }
        }
      } catch {
        setError(CONNECTION_FAILED_MESSAGE);
      }
    };

    ws.onMessage((msg: ServerMessage) => {
      // StrictMode dev: 이전 effect의 ws 이벤트가 비동기로 도착할 수 있으므로 무시
      if (wsRef.current !== ws) return;
      void handleMessage(msg);
    });
    ws.onClose(() => {
      // StrictMode dev: 이전 effect가 close한 ws의 onclose가 비동기로 도착할 때 활성 ws를 끊지 않도록
      if (wsRef.current !== ws) return;
      if (cleanedUpRef.current) return; // 우리가 직접 닫은 경우 무시
      finishEnded("dropped");
    });

    // 백그라운드에서 일부 환경(특히 모바일 WebView)이 audio 재생을 일시 정지할 수 있어
    // visible 복귀 시 paused 라면 다시 play() 를 시도한다 (안전망)
    const handleVisibilityChange = () => {
      if (document.hidden) return;
      const el = remoteAudioRef.current;
      if (!el || !el.srcObject) return;
      if (el.paused) {
        void el.play().catch(() => {
          // 자동재생 정책 거부 — 사용자 인터랙션 시점에 다시 시도되도록 무시
        });
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    (async () => {
      try {
        await peer.start();
        if (cancelled) return;
        ws.send({ type: "JOIN" });
      } catch {
        if (cancelled) return;
        setError(PERMISSION_DENIED_MESSAGE);
      }
    })();

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      cleanup();
    };
    // userId/roomId/partnerId 변경 시에만 재실행
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.userId, opts.roomId, opts.partnerId]);

  return {
    status,
    errorMessage,
    endReason,
    isMuted,
    toggleMute: () => {
      const next = !isMuted;
      peerRef.current?.setMicEnabled(!next);
      setIsMuted(next);
    },
    isSpeakerOn,
    toggleSpeaker: () => {
      const next = !isSpeakerOn;
      void setSpeakerphone(next).catch(() => {
        // 네이티브 라우팅 실패는 무시 — UI 상태는 사용자 의도대로 반영
      });
      setIsSpeakerOn(next);
    },
    end: (reason: EndReason = "self") => {
      if (cleanedUpRef.current) return;
      wsRef.current?.send({ type: "HANGUP" });
      finishEnded(reason);
    },
    remoteAudioRef,
    getLocalStream: () => peerRef.current?.getLocalStream() ?? null,
  };
}
