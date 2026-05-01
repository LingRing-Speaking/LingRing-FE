import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageShell } from "@/components/PageShell";
import { env } from "@/config/env";
import { cancelMatchingQueue } from "@/domains/matching/api/matchingApi";
import { useEnterMatchingQueue } from "@/domains/matching/hooks/useEnterMatchingQueue";
import { useMatchingStatus } from "@/domains/matching/hooks/useMatchingStatus";
import { useRandomIcebreakers } from "@/domains/icebreaker/hooks/useRandomIcebreakers";
import { BreathingOrb } from "./BreathingOrb";
import { CancelConfirmSheet } from "./CancelConfirmSheet";
import { FALLBACK_ICEBREAKERS } from "./fallbackIcebreakers";
import { IcebreakerRotator } from "./IcebreakerRotator";

const ICEBREAKER_COUNT = 5;
const ROTATION_INTERVAL_MS = 7000;
const FADE_MS = 280;

export function MatchingPage() {
  const navigate = useNavigate();
  const userId = env.devUserId;
  const [sheetOpen, setSheetOpen] = useState(false);
  const { data: icebreakers } = useRandomIcebreakers(ICEBREAKER_COUNT);

  const enter = useEnterMatchingQueue();
  const status = useMatchingStatus(userId, enter.isSuccess);

  const enteredRef = useRef(false);

  const fireEnter = () => {
    enter.mutate(userId, {
      onSuccess: () => {
        enteredRef.current = true;
      },
    });
  };

  useEffect(() => {
    fireEnter();
    return () => {
      if (enteredRef.current) {
        cancelMatchingQueue(userId).catch(() => {});
      }
    };
    // userId 변경 시에만 재실행 — fireEnter는 매 렌더 새 함수이지만
    // 내부에서 사용하는 enter.mutate는 stable, userId는 deps에 포함됨.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    const data = status.data;
    if (data?.status !== "MATCHED") return;
    if (!data.roomId || data.partnerId == null) return;
    enteredRef.current = false;
    navigate(`/call/${data.roomId}`, {
      state: { partnerId: data.partnerId },
      replace: true,
    });
  }, [status.data, navigate]);

  const sentences = icebreakers ?? FALLBACK_ICEBREAKERS;

  const openSheet = () => setSheetOpen(true);
  const closeSheet = () => setSheetOpen(false);
  const handleCancel = () => {
    setSheetOpen(false);
    navigate("/home");
  };

  const handleRetry = () => {
    fireEnter();
  };
  const handleGoHome = () => navigate("/home");

  return (
    <PageShell>
      <main className="relative flex flex-1 flex-col overflow-hidden bg-gradient-to-b from-mint-50 to-white">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 -top-[70px] z-0 h-[280px] w-[280px] rounded-full bg-mint-200 opacity-35 blur-[60px]"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -left-20 bottom-40 z-0 h-[220px] w-[220px] rounded-full bg-coral-100 opacity-55 blur-[60px]"
        />

        <div className="relative z-[5] flex items-center justify-between px-4 pt-2">
          <button
            type="button"
            aria-label="닫기"
            onClick={openSheet}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-gray-700 active:bg-gray-100"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
          <span className="text-[15px] font-semibold leading-none tracking-[-0.01em] text-gray-800">
            매칭 중
          </span>
          <span className="w-10" />
        </div>

        {enter.isError ? (
          <div className="relative z-[1] flex flex-1 flex-col items-center justify-center gap-4 px-6">
            <p className="m-0 text-[15px] font-medium text-gray-700">매칭을 시작할 수 없어요.</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleRetry}
                className="rounded-md bg-mint-500 px-5 py-2.5 text-[14px] font-semibold text-white"
              >
                다시 시도
              </button>
              <button
                type="button"
                onClick={handleGoHome}
                className="rounded-md border border-gray-300 px-5 py-2.5 text-[14px] font-semibold text-gray-700"
              >
                메인으로
              </button>
            </div>
          </div>
        ) : (
          <div className="relative z-[1] flex flex-1 flex-col items-center px-6 pt-5">
            <BreathingOrb />

            <div className="mb-4 text-center">
              <h1 className="m-0 mb-1.5 text-[20px] font-bold leading-snug tracking-[-0.02em] text-gray-900">
                대화할 사람을 찾고 있어요
              </h1>
              <p className="m-0 text-[13px] font-medium leading-relaxed text-gray-600">
                보통 <strong className="font-bold text-mint-600">30초 이내</strong>에 매칭돼요
              </p>
            </div>

            <IcebreakerRotator
              sentences={sentences}
              intervalMs={ROTATION_INTERVAL_MS}
              fadeMs={FADE_MS}
            />

            <div className="mt-auto flex justify-center pb-6 pt-2">
              <button
                type="button"
                onClick={openSheet}
                className="rounded-md px-5 py-3.5 text-[14px] font-semibold leading-none tracking-[-0.01em] text-gray-500 active:bg-gray-100 active:text-gray-700"
              >
                매칭 취소
              </button>
            </div>
          </div>
        )}

        <CancelConfirmSheet open={sheetOpen} onKeep={closeSheet} onCancel={handleCancel} />
      </main>
    </PageShell>
  );
}
