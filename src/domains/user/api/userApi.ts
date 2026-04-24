import { httpGet } from "@/lib/http";
import type { UserMy, UserStats } from "../types";

export const fetchUserMy = (userId: number) =>
  httpGet<UserMy>(`/users/${userId}/my`);

export const fetchUserStats = (userId: number) =>
  httpGet<UserStats>(`/users/${userId}/stats`);
