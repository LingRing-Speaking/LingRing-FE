import { httpGet } from "@/lib/http";
import type { UserExpressionList } from "../types";

export const fetchUserExpressions = (
  userId: number,
  page: number,
  size: number,
) =>
  httpGet<UserExpressionList>(
    `/users/${userId}/expressions?page=${page}&size=${size}`,
  );
