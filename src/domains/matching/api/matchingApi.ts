import { httpDelete, httpGet, httpPost } from "@/lib/http";
import type { MatchingStatus } from "../types";

const MATCHING_PATH = "/me/matching";

export const enterMatchingQueue = (): Promise<void> => httpPost(MATCHING_PATH);

export const cancelMatchingQueue = (): Promise<void> => httpDelete(MATCHING_PATH);

export const fetchMatchingStatus = (): Promise<MatchingStatus> =>
  httpGet<MatchingStatus>(MATCHING_PATH);
