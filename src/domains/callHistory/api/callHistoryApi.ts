import { httpGet } from "@/lib/http";
import type { CallHistoryList } from "../types";

export const fetchCallHistory = (page: number, size: number) =>
  httpGet<CallHistoryList>(`/calls?page=${page}&size=${size}`);
