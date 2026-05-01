import { httpGet } from "@/lib/http";
import type { UserStats } from "../types";

export const fetchMyStats = () => httpGet<UserStats>("/me/stats");
