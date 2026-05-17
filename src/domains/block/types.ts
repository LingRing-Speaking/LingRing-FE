export type BlockedUser = {
  id: number;
  userId: number;
  blockedUserId: number;
  nickname: string;
  profileImage: string | null;
  createdAt: string;
};

export type BlockListResponse = {
  items: BlockedUser[];
  hasNext: boolean;
};

export type BlockCreateInput = {
  blockedUserId: number;
};
