import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/domains/auth/store";
import { useMyStats } from "@/domains/user/hooks/useMyStats";
import { BottomTabBar } from "@/components/BottomTabBar";
import { PageShell } from "@/components/PageShell";
// 저장한 표현 기능 미출시 — 진입 동선('내 기록' 섹션) 자체를 노출하지 않음.
// 출시 시 import 와 마운트 위치 복원.
// import { MyRecords } from "./MyRecords";
import { ProfileCard } from "./ProfileCard";
import { WeeklyStats } from "./WeeklyStats";

export function MyPagePage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const myStats = useMyStats();

  const status = (() => {
    if (myStats.isError) return "error";
    if (myStats.isPending) return "loading";
    return "success";
  })();

  const handleRetry = () => {
    myStats.refetch();
  };

  return (
    <PageShell>
      <main className="relative flex flex-1 flex-col bg-gray-50">
        <div className="scroll-area scrollbar-none flex-1 overflow-y-auto px-5 pb-[92px] pt-3.5">
          <div className="my-2.5 mb-5 flex items-center justify-between">
            <h1 className="m-0 text-[22px] font-extrabold leading-tight tracking-tight">
              마이페이지
            </h1>
            <button
              type="button"
              aria-label="앱 설정"
              onClick={() => navigate("/settings")}
              className="-mr-2 flex h-10 w-10 items-center justify-center rounded-full text-gray-700 transition-colors active:bg-gray-100"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
          </div>

          {status === "loading" && (
            <div className="flex h-60 items-center justify-center">
              <div
                role="status"
                aria-label="로딩 중"
                className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-mint-500"
              />
            </div>
          )}

          {status === "error" && (
            <div className="flex h-60 flex-col items-center justify-center gap-4">
              <p className="text-[15px] font-medium text-gray-700">정보를 불러오지 못했어요.</p>
              <button
                type="button"
                onClick={handleRetry}
                className="rounded-md bg-mint-500 px-5 py-2.5 text-[14px] font-semibold text-white"
              >
                다시 시도
              </button>
            </div>
          )}

          {status === "success" && user && myStats.data && (
            <>
              <ProfileCard
                name={user.nickname}
                profileImage={user.profileImage}
                level={myStats.data.level}
                mannerTemperature={myStats.data.mannerTemperature}
              />
              <WeeklyStats
                currentStreakDays={myStats.data.currentStreakDays}
                totalCallCount={myStats.data.totalCallCount}
              />
              {/* <MyRecords /> — 저장한 표현 기능 미출시. 출시 시 복원 */}
            </>
          )}
        </div>
        <BottomTabBar />
      </main>
    </PageShell>
  );
}
