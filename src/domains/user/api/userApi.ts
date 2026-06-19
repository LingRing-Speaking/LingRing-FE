import { httpGet } from "@/lib/http";
import type { UserProfile, UserStats } from "../types";

export const fetchMyStats = () => httpGet<UserStats>("/me/stats");

export const fetchUserProfile = (userId: number) =>
  httpGet<UserProfile>(`/users/${userId}`);
