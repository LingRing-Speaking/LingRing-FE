import { httpDelete, httpGet, httpPost } from "@/lib/http";
import type { MatchingStatus } from "../types";

const matchingPath = (userId: number) => `/users/${userId}/matching`;

export const enterMatchingQueue = (userId: number): Promise<void> =>
  httpPost(matchingPath(userId));

export const cancelMatchingQueue = (userId: number): Promise<void> =>
  httpDelete(matchingPath(userId));

export const fetchMatchingStatus = (userId: number): Promise<MatchingStatus> =>
  httpGet<MatchingStatus>(matchingPath(userId));
