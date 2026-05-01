import { httpGet } from "@/lib/http";
import type { User } from "../types";

export function getMe(): Promise<User> {
  return httpGet<User>("/auth/me");
}
