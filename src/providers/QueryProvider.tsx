import { QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useEffect, useState } from "react";
import { useAuthStore } from "@/domains/auth/store";
import { createQueryClient } from "./queryClient";

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);

  // 쿼리 키가 사용자로 구분되지 않으므로, 세션이 끝나거나 계정이 바뀌면 이전 계정의
  // 서버 데이터가 다음 계정에 쓰이지 않도록 캐시를 통째로 비운다 (#246).
  // 세션 정리 경로(로그아웃·탈퇴·세션 만료)가 여러 곳이라 스토어 변화를 한 곳에서 구독한다.
  useEffect(
    () =>
      useAuthStore.subscribe((state, prev) => {
        const hasUserChanged = prev.user !== null && state.user?.id !== prev.user.id;
        if (hasUserChanged) queryClient.clear();
      }),
    [queryClient],
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
