import { httpGet } from "@/lib/http";
import type { UserExpressionList } from "../types";

export const fetchUserExpressions = (page: number, size: number) =>
  httpGet<UserExpressionList>(`/expressions?page=${page}&size=${size}`);
