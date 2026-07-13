import { httpDelete, httpGet, httpPatch, httpPost } from "@/lib/http";
import type {
  FriendDirection,
  FriendList,
  FriendSearchResult,
  FriendStatus,
  SendFriendRequestResult,
} from "../types";

type FetchFriendsParams = {
  status: FriendStatus;
  direction?: FriendDirection; // PENDING 조회에서 받은/보낸 분리용. 생략 시 둘 다
  page: number;
  size: number;
};

export const fetchFriends = ({ status, direction, page, size }: FetchFriendsParams) => {
  const query = new URLSearchParams({
    status,
    page: String(page),
    size: String(size),
  });
  if (direction) query.set("direction", direction);
  return httpGet<FriendList>(`/friends?${query.toString()}`);
};

// 탭 바·요청 카드 뱃지용. 목록을 로드하지 않고 받은 요청 개수만 가져온다.
export const fetchReceivedCount = () => httpGet<{ count: number }>("/friends/received-count");

// 닉네임 정확 일치 검색. 일치하는 유저가 없으면 서버가 data: null 을 주므로 null 을 반환한다.
export const searchFriend = (nickname: string) =>
  httpGet<FriendSearchResult | null>(`/friends/search?nickname=${encodeURIComponent(nickname)}`);

// 친구 요청 보내기. 나중에 "통화 종료 후 친구 추가"에서도 재사용할 액션.
export const sendFriendRequest = (targetUserId: number) =>
  httpPost<SendFriendRequestResult>("/friends", { targetUserId });

// 받은 요청 수락. requesterId = 나에게 요청을 보낸 사람의 userId.
export const acceptFriendRequest = (requesterId: number) =>
  httpPatch<SendFriendRequestResult>(`/friends/${requesterId}`, {
    status: "ACCEPTED",
  });

// 관계 제거 공용 — 받은 요청 거절 · 보낸 요청 취소 · 친구 삭제 모두 이 하나로 처리.
// 관계가 없어도 204(멱등)라 호출자는 성공 처리만 하면 된다.
export const removeRelation = (userId: number) => httpDelete<void>(`/friends/${userId}`);
