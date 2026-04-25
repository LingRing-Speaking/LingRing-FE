import { env } from "@/config/env";
import { useDailyRecommendedExpression } from "@/domains/recommendedExpression/hooks/useDailyRecommendedExpression";
import { useUserMy } from "@/domains/user/hooks/useUserMy";
import { BottomTabBar } from "@/components/BottomTabBar";
import { CallHero } from "./CallHero";
import { DailyExpressionCard } from "./DailyExpressionCard";
import { Greeting } from "./Greeting";

export function MainPage() {
  const userMy = useUserMy(env.devUserId);
  const dailyExpression = useDailyRecommendedExpression();

  const status = (() => {
    if (userMy.isError || dailyExpression.isError) return "error";
    if (userMy.isPending || dailyExpression.isPending) return "loading";
    return "success";
  })();

  const handleRetry = () => {
    userMy.refetch();
    dailyExpression.refetch();
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
            className="pointer-events-none absolute -right-[60px] -top-[60px] z-0 h-[220px] w-[220px] rounded-full bg-mint-200 opacity-55 blur-[50px]"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -left-[50px] bottom-[220px] z-0 h-[180px] w-[180px] rounded-full bg-coral-100 opacity-80 blur-[50px]"
          />

          <div className="relative z-[1] flex flex-1 flex-col overflow-y-auto px-5 pb-[78px] pt-2">
            {status === "loading" && (
              <div className="flex flex-1 items-center justify-center">
                <div
                  role="status"
                  aria-label="로딩 중"
                  className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-mint-500"
                />
              </div>
            )}

            {status === "error" && (
              <div className="flex flex-1 flex-col items-center justify-center gap-4">
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

            {status === "success" && userMy.data && (
              <>
                <Greeting name={userMy.data.name} />
                <DailyExpressionCard data={dailyExpression.data ?? null} />
                <CallHero />
              </>
            )}
          </div>

          <BottomTabBar />
        </main>
      </div>
    </div>
  );
}
