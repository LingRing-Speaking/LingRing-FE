import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { fetchDailyRecommendedExpression } from "../api/recommendedExpressionApi";
import type { DailyRecommendedExpression } from "../types";

const ONE_DAY_MS = 1000 * 60 * 60 * 24;

export const todayKstDateString = (): string =>
  new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });

export function useDailyRecommendedExpression(): UseQueryResult<
  DailyRecommendedExpression | null,
  Error
> {
  return useQuery({
    queryKey: ["recommendedExpression", "daily", todayKstDateString()],
    queryFn: fetchDailyRecommendedExpression,
    staleTime: Infinity,
    gcTime: ONE_DAY_MS,
  });
}
