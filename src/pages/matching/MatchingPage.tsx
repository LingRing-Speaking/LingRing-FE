import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
  const [sheetOpen, setSheetOpen] = useState(false);
  const { data } = useRandomIcebreakers(ICEBREAKER_COUNT);

  const sentences = data ?? FALLBACK_ICEBREAKERS;

  const openSheet = () => setSheetOpen(true);
  const closeSheet = () => setSheetOpen(false);
  const handleCancel = () => {
    setSheetOpen(false);
    navigate("/");
  };

  return (
    <div className="viewport flex min-h-dvh items-center justify-center bg-[#E7EAEE] p-6">
      <div className="phone relative h-[812px] w-[375px] overflow-hidden rounded-[44px] bg-white shadow-[0_0_0_10px_#1A1D22,0_30px_60px_rgba(0,0,0,0.25)] md:h-dvh md:w-full md:rounded-none md:shadow-none">
        <header className="relative z-10 flex h-11 items-center justify-between bg-white px-6 text-[15px] font-semibold text-gray-900">
          <span>9:41</span>
        </header>

        <main className="relative flex h-[calc(100%-44px)] flex-col overflow-hidden bg-gradient-to-b from-mint-50 to-white">
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

          <CancelConfirmSheet
            open={sheetOpen}
            onKeep={closeSheet}
            onCancel={handleCancel}
          />
        </main>
      </div>
    </div>
  );
}
