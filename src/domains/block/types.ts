export type Block = {
  id: number;
  userId: number;
  blockedUserId: number;
  createdAt: string;
};

export type BlockListItem = {
  id: number;
  blockedUserId: number;
  nickname: string;
  profileImage: string | null;
  createdAt: string;
};

export type BlockListResponse = {
  items: BlockListItem[];
  hasNext: boolean;
};

export type BlockCreateInput = {
  blockedUserId: number;
};
