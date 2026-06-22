export function EmptyCallHistory() {
  return (
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
          <path
            d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
            transform="translate(15 16) scale(1.4)"
            fill="none"
            stroke="#10A47A"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <h2 className="m-0 mb-2 text-[17px] font-bold leading-[1.4] tracking-[-0.02em] text-gray-900">
        아직 통화 기록이 없어요
      </h2>
      <p className="m-0 max-w-[240px] text-[14.5px] font-medium leading-[1.55] tracking-[-0.01em] text-gray-500">
        첫 통화를 시작해보세요.
      </p>
    </div>
  );
}
