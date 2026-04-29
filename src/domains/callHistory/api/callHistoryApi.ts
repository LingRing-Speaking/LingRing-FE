import { httpGet } from "@/lib/http";
import type { CallHistoryList } from "../types";

export const fetchCallHistory = (
  userId: number,
  page: number,
  size: number,
) =>
  httpGet<CallHistoryList>(
    `/users/${userId}/calls?page=${page}&size=${size}`,
  );
