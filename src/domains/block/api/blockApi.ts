import { httpDelete, httpGet, httpPost } from "@/lib/http";
import type { BlockCreateInput, BlockListResponse, BlockedUser } from "../types";

const BLOCKS_PATH = "/blocks";

export const createBlock = (input: BlockCreateInput): Promise<BlockedUser> =>
  httpPost<BlockedUser>(BLOCKS_PATH, input);

export const deleteBlock = (blockedUserId: number): Promise<void> =>
  httpDelete(`${BLOCKS_PATH}/${blockedUserId}`);

export const fetchBlockedUsers = (page: number, size: number): Promise<BlockListResponse> =>
  httpGet<BlockListResponse>(`${BLOCKS_PATH}?page=${page}&size=${size}`);
