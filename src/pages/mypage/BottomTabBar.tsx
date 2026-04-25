export function BottomTabBar() {
  return (
    <nav
      aria-label="메인 네비게이션"
      className="absolute bottom-0 left-0 right-0 flex h-[72px] items-start border-t border-gray-100 bg-white pt-2 shadow-nav"
    >
      <button
        type="button"
        disabled
        aria-disabled="true"
        className="flex flex-1 cursor-not-allowed flex-col items-center gap-1 py-1.5 text-gray-400"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 12 12 3l9 9" />
          <path d="M5 10v10a1 1 0 0 0 1 1h4v-7h4v7h4a1 1 0 0 0 1-1V10" />
        </svg>
        <span className="text-[11px] font-semibold tracking-tight">홈</span>
      </button>

      <button
        type="button"
        disabled
        aria-disabled="true"
        className="flex flex-1 cursor-not-allowed flex-col items-center gap-1 py-1.5 text-gray-400"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        <span className="text-[11px] font-semibold tracking-tight">
          대화 기록
        </span>
      </button>

      <button
        type="button"
        aria-current="page"
        className="flex flex-1 flex-col items-center gap-1 py-1.5 text-gray-900"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-6 w-6"
          fill="currentColor"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
        <span className="text-[11px] font-semibold tracking-tight">
          마이페이지
        </span>
      </button>
    </nav>
  );
}
