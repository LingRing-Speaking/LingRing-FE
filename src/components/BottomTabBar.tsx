import { Link, useLocation } from "react-router-dom";

const TAB_BASE =
  "flex flex-1 flex-col items-center gap-1 py-1.5 text-[11px] font-semibold tracking-tight";

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill={active ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path
        d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-9.5Z"
        fillOpacity={active ? 0.12 : 0}
      />
    </svg>
  );
}

function HistoryIcon() {
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
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function MyPageIcon({ active }: { active: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill={active ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

export function BottomTabBar() {
  const { pathname } = useLocation();
  const isHome = pathname === "/";
  const isMyPage = pathname === "/mypage";

  return (
    <nav
      aria-label="메인 네비게이션"
      className="absolute bottom-0 left-0 right-0 z-10 flex h-[72px] items-start border-t border-gray-100 bg-white pt-2 shadow-nav"
    >
      <Link
        to="/"
        aria-current={isHome ? "page" : undefined}
        className={`${TAB_BASE} ${isHome ? "text-gray-900" : "text-gray-400"}`}
      >
        <HomeIcon active={isHome} />
        <span>홈</span>
      </Link>

      <button
        type="button"
        disabled
        aria-disabled="true"
        className={`${TAB_BASE} cursor-not-allowed text-gray-400`}
      >
        <HistoryIcon />
        <span>대화 기록</span>
      </button>

      <Link
        to="/mypage"
        aria-current={isMyPage ? "page" : undefined}
        className={`${TAB_BASE} ${isMyPage ? "text-gray-900" : "text-gray-400"}`}
      >
        <MyPageIcon active={isMyPage} />
        <span>마이페이지</span>
      </Link>
    </nav>
  );
}
