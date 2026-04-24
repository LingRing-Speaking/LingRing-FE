import { env } from "@/config/env";
import { useUserMy } from "@/domains/user/hooks/useUserMy";
import { useUserStats } from "@/domains/user/hooks/useUserStats";
import { BottomTabBar } from "./BottomTabBar";
import { MyRecords } from "./MyRecords";
import { ProfileCard } from "./ProfileCard";
import { WeeklyStats } from "./WeeklyStats";

export function MyPagePage() {
  const userMy = useUserMy(env.devUserId);
  const userStats = useUserStats(env.devUserId);

  const status = (() => {
    if (userMy.isError || userStats.isError) return "error";
    if (userMy.isPending || userStats.isPending) return "loading";
    return "success";
  })();

  const handleRetry = () => {
    userMy.refetch();
    userStats.refetch();
  };

  return (
    <div className="viewport flex min-h-dvh items-center justify-center bg-[#E7EAEE] p-6">
      <div className="phone relative h-[812px] w-[375px] overflow-hidden rounded-[44px] bg-white shadow-[0_0_0_10px_#1A1D22,0_30px_60px_rgba(0,0,0,0.25)] md:h-dvh md:w-full md:rounded-none md:shadow-none">
        <header className="relative z-10 flex h-11 items-center justify-between bg-white px-6 text-[15px] font-semibold text-gray-900">
          <span>9:41</span>
        </header>

        <main className="relative flex h-[calc(100%-44px)] flex-col bg-gray-50">
          <div className="scroll-area scrollbar-none flex-1 overflow-y-auto px-5 pb-[92px] pt-3.5">
            <div className="my-2.5 mb-5 flex items-center justify-between">
              <h1 className="m-0 text-[22px] font-extrabold leading-tight tracking-tight">
                마이페이지
              </h1>
              <button
                type="button"
                aria-label="앱 설정"
                disabled
                className="-mr-2 flex h-10 w-10 cursor-not-allowed items-center justify-center rounded-full text-gray-700"
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
                <p className="text-[15px] font-medium text-gray-700">
                  정보를 불러오지 못했어요.
                </p>
                <button
                  type="button"
                  onClick={handleRetry}
                  className="rounded-md bg-mint-500 px-5 py-2.5 text-[14px] font-semibold text-white"
                >
                  다시 시도
                </button>
              </div>
            )}

            {status === "success" && userMy.data && userStats.data && (
              <>
                <ProfileCard
                  name={userMy.data.name}
                  level={userStats.data.level}
                  mannerTemperature={userStats.data.mannerTemperature}
                />
                <WeeklyStats
                  currentStreakDays={userStats.data.currentStreakDays}
                  totalCallCount={userStats.data.totalCallCount}
                />
                <MyRecords
                  savedExpressionCount={userStats.data.savedExpressionCount}
                />
              </>
            )}
          </div>
          <BottomTabBar />
        </main>
      </div>
    </div>
  );
}
