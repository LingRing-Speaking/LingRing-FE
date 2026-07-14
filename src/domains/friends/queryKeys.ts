import type { FriendDirection } from "./types";

// 친구 도메인 쿼리 키. 모든 키가 ["friends", ...] 로 시작하므로, mutation 후
// invalidateQueries({ queryKey: friendKeys.all }) 한 번으로 목록·요청·개수·검색이
// 함께 갱신된다.
export const friendKeys = {
  all: ["friends"] as const,
  accepted: ["friends", "accepted"] as const,
  pending: (direction: FriendDirection) => ["friends", "pending", direction] as const,
  receivedCount: ["friends", "receivedCount"] as const,
  search: (nickname: string) => ["friends", "search", nickname] as const,
};
