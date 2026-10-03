import { useNavigate } from "react-router-dom";
import { useMatchingOpen } from "@/domains/matching/hooks/useMatchingOpen";

// 버튼 뒤로 퍼지는 링 3개의 시작 지연 — 1.5초 간격으로 겹쳐 연속 파동처럼 보이게 한다.
const PULSE_RING_DELAYS = ["0s", "1.5s", "3s"];

export function CallHero() {
  const navigate = useNavigate();
  const isMatchingOpen = useMatchingOpen();

  return (
    <div className="flex flex-1 flex-col items-center justify-center pb-[30px]">
      <p className="m-0 mb-6 text-center text-[17px] font-bold leading-snug tracking-[-0.01em] text-gray-800">
        {isMatchingOpen ? (
          <>
            버튼을 눌러 학습 파트너와
            <br />
            대화를 시작해봐요
          </>
        ) : (
          "매칭은 매일 저녁 8시~11시에 열려요"
        )}
      </p>

      <div className="relative flex h-[220px] w-[220px] items-center justify-center">
        {isMatchingOpen &&
          PULSE_RING_DELAYS.map((delay) => (
            <span
              key={delay}
              aria-hidden="true"
              className="absolute inset-0 rounded-full bg-mint-200 opacity-0 animate-pulse-ring"
              style={{ animationDelay: delay }}
            />
          ))}

        <button
          type="button"
          aria-label="통화 시작하기"
          disabled={!isMatchingOpen}
          onClick={() => navigate("/matching")}
          className="relative z-[1] flex h-[160px] w-[160px] cursor-pointer flex-col items-center justify-center gap-2 rounded-full border-0 bg-gradient-to-br from-mint-400 via-mint-500 to-coral-500 text-white shadow-button transition-transform active:scale-95 disabled:cursor-default disabled:bg-none disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none disabled:active:scale-100"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-12 w-12"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.72 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0 1 22 16.92z" />
          </svg>
          <span className="text-[17px] font-bold leading-none tracking-[-0.01em]">
            통화 시작하기
          </span>
        </button>
      </div>
    </div>
  );
}
