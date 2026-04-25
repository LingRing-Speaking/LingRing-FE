export function EmptyExpressions() {
  return (
    <div className="relative flex flex-1 flex-col">
      <div className="flex flex-1 flex-col items-center justify-center px-8 pb-32 text-center">
        <div
          aria-hidden="true"
          className="mb-6 flex h-[120px] w-[120px] items-center justify-center rounded-full bg-mint-50"
        >
          <svg
            width="64"
            height="64"
            viewBox="0 0 64 64"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="empty-mint" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#3ECFA5" />
                <stop offset="100%" stopColor="#10A47A" />
              </linearGradient>
              <linearGradient
                id="empty-coral"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="100%"
              >
                <stop offset="0%" stopColor="#FFB4A0" />
                <stop offset="100%" stopColor="#F26849" />
              </linearGradient>
            </defs>
            <circle
              cx="23"
              cy="32"
              r="14"
              fill="none"
              stroke="url(#empty-mint)"
              strokeWidth="5.5"
            />
            <circle
              cx="41"
              cy="32"
              r="14"
              fill="none"
              stroke="url(#empty-coral)"
              strokeWidth="5.5"
            />
          </svg>
        </div>
        <h2 className="m-0 mb-2 text-[17px] font-bold leading-[1.4] tracking-[-0.02em] text-gray-900">
          아직 저장한 표현이 없어요
        </h2>
        <p className="m-0 max-w-[240px] text-[14.5px] font-medium leading-[1.55] tracking-[-0.01em] text-gray-500">
          통화 후 마음에 든 표현을 저장해보세요
        </p>
      </div>
      <div className="absolute bottom-0 left-0 right-0 px-5 pb-7 pt-4">
        <button
          type="button"
          disabled
          aria-disabled="true"
          className="h-14 w-full cursor-not-allowed rounded-2xl bg-gray-200 text-[16px] font-bold leading-none tracking-[-0.01em] text-gray-500"
        >
          통화 시작하기
        </button>
      </div>
    </div>
  );
}
