export function CallHero() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center pb-[30px]">
      <p className="m-0 mb-1.5 text-[15px] font-semibold text-gray-700">
        오늘은 누구와 만나게 될까요?
      </p>
      <p className="m-0 mb-6 text-[13px] font-medium text-gray-500">
        버튼을 눌러 랜덤 매칭을 시작해요
      </p>

      <div className="relative flex h-[220px] w-[220px] items-center justify-center">
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-full bg-mint-200 opacity-0 animate-pulse-ring"
        />
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-full bg-mint-200 opacity-0 animate-pulse-ring"
          style={{ animationDelay: "1.5s" }}
        />
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-full bg-mint-200 opacity-0 animate-pulse-ring"
          style={{ animationDelay: "3s" }}
        />

        <button
          type="button"
          disabled
          aria-disabled="true"
          aria-label="통화 시작하기"
          className="relative z-[1] flex h-[160px] w-[160px] cursor-not-allowed flex-col items-center justify-center gap-2 rounded-full border-0 bg-gradient-to-br from-mint-400 via-mint-500 to-coral-500 text-white shadow-button"
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
