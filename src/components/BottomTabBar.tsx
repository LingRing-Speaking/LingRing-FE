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

function CallHistoryIcon({ active }: { active: boolean }) {
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
        d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"
        fillOpacity={active ? 0.12 : 0}
      />
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
  const isHome = pathname === "/home";
  const isHistory = pathname === "/history";
  const isMyPage = pathname === "/mypage";

  return (
    <nav
      aria-label="메인 네비게이션"
      className="absolute bottom-0 left-0 right-0 z-10 flex h-[72px] items-start border-t border-gray-100 bg-white pt-2 shadow-nav"
    >
      <Link
        to="/home"
        aria-current={isHome ? "page" : undefined}
        className={`${TAB_BASE} ${isHome ? "text-gray-900" : "text-gray-400"}`}
      >
        <HomeIcon active={isHome} />
        <span>홈</span>
      </Link>

      <Link
        to="/history"
        aria-current={isHistory ? "page" : undefined}
        className={`${TAB_BASE} ${isHistory ? "text-gray-900" : "text-gray-400"}`}
      >
        <CallHistoryIcon active={isHistory} />
        <span>통화기록</span>
      </Link>

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
