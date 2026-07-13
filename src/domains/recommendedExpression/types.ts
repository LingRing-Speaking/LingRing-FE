export type DailyRecommendedExpression = {
  id: number;
  expression: string;
  meaning: string;
  createdAt: string;
  /** 찜(저장)했으면 저장한 표현 row id, 아니면 null. 별표 상태의 출처. */
  bookmarkId: number | null;
};
