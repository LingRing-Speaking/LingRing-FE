import { httpPost } from "@/lib/http";

// 서버 측 refresh token을 무효화. 인증 헤더는 httpPost가 자동 부착.
export function logout(): Promise<void> {
  return httpPost<void>("/auth/logout");
}
