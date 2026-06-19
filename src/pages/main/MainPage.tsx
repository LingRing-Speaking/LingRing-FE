import { useAuthStore } from "@/domains/auth/store";
import { useDailyRecommendedExpression } from "@/domains/recommendedExpression/hooks/useDailyRecommendedExpression";
import { BottomTabBar } from "@/components/BottomTabBar";
import { PageShell } from "@/components/PageShell";
import { CallHero } from "./CallHero";
import { DailyExpressionCard } from "./DailyExpressionCard";
import { Greeting } from "./Greeting";

export function MainPage() {
  const user = useAuthStore((state) => state.user);
  const dailyExpression = useDailyRecommendedExpression();

  const status = (() => {
    if (dailyExpression.isError) return "error";
    if (dailyExpression.isPending) return "loading";
    return "success";
  })();

  const handleRetry = () => {
    dailyExpression.refetch();
  };

  return (
    <PageShell>
      <main className="relative flex flex-1 flex-col overflow-hidden bg-gradient-to-b from-mint-50 to-white">
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

          {status === "success" && user && (
            <>
              <Greeting name={user.nickname} />
              <DailyExpressionCard data={dailyExpression.data ?? null} />
              <CallHero />
            </>
          )}
        </div>

        <BottomTabBar />
      </main>
    </PageShell>
  );
}
