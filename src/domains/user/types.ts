import type { FriendRelation } from "@/domains/friends/types";

export type Level = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";

export type UserProfile = {
  id: number;
  nickname: string;
  profileImage: string | null;
  level: Level;
  mannerTemperature: number;
  relation: FriendRelation; // 조회한 사람과 이 유저의 친구 관계 (#215)
};

export type UserStats = {
  userId: number;
  level: Level;
  mannerTemperature: number;
  totalCallCount: number;
  currentStreakDays: number;
  expressionCount: number;
  lastStudyDate: string | null;
};
