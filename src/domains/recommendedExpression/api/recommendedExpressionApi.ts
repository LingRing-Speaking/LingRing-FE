import { ApiError, httpGet } from "@/lib/http";
import type { DailyRecommendedExpression } from "../types";

export const fetchDailyRecommendedExpression = async (): Promise<
  DailyRecommendedExpression | null
> => {
  try {
    return await httpGet<DailyRecommendedExpression>(
      "/recommended-expressions/daily",
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
};
