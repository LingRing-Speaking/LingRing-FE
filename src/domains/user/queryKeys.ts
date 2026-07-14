// 유저 도메인 쿼리 키. 프로필 응답에 relation(친구 관계)이 포함되므로,
// 친구 mutation 후 userKeys.all 무효화로 열려 있는 프로필 모달의 버튼이 갱신된다.
export const userKeys = {
  all: ["users"] as const,
  profile: (userId: number) => ["users", userId] as const,
};
