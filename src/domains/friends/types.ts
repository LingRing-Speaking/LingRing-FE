export type FriendStatus = "PENDING" | "ACCEPTED";

// PENDING 관계에서 요청 방향. RECEIVED = 내가 받은 요청, SENT = 내가 보낸 요청.
export type FriendDirection = "RECEIVED" | "SENT";

// 검색 결과에서 "그 유저와 나"의 관계. 버튼을 이 값으로 그린다.
export type FriendRelation = "NONE" | "REQUEST_SENT" | "REQUEST_RECEIVED" | "FRIEND" | "SELF";

export type FriendItem = {
  userId: number;
  nickname: string | null; // 상대 탈퇴 시 null
  profileImage: string | null; // 없거나 탈퇴 시 null
  status: FriendStatus;
  direction: FriendDirection; // PENDING 일 때만 의미. ACCEPTED 면 무시
  requestedAt: string;
};

export type FriendList = {
  items: FriendItem[];
  hasNext: boolean;
};

export type FriendSearchResult = {
  userId: number;
  nickname: string;
  profileImage: string | null;
  relation: FriendRelation;
};

// POST /friends 응답. 상대가 이미 나에게 보낸 요청이 있으면 status 가 ACCEPTED 로
// 즉시 친구가 되고, 아니면 PENDING(요청 보냄).
export type SendFriendRequestResult = {
  userId: number;
  status: FriendStatus;
};
