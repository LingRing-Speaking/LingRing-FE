export type Level = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";

export type UserStats = {
  userId: number;
  level: Level;
  mannerTemperature: number;
  totalCallCount: number;
  currentStreakDays: number;
  expressionCount: number;
  lastStudyDate: string | null;
};
