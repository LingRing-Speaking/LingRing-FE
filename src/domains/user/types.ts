export type Level = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";

export type UserMy = {
  id: number;
  name: string;
};

export type UserStats = {
  userId: number;
  level: Level;
  mannerTemperature: number;
  totalCallCount: number;
  currentStreakDays: number;
  savedExpressionCount: number;
  lastStudyDate: string | null;
};
