import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { fetchDailyRecommendedExpression } from "../api/recommendedExpressionApi";
import type { DailyRecommendedExpression } from "../types";

export function useDailyRecommendedExpression(): UseQueryResult<
  DailyRecommendedExpression | null,
  Error
> {
  return useQuery({
    queryKey: ["recommendedExpression", "daily"],
    queryFn: fetchDailyRecommendedExpression,
  });
}
