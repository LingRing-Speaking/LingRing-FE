import type { ReactNode } from "react";

type PageShellProps = {
  children: ReactNode;
};

// 모바일: 풀스크린 + iOS safe-area 패딩으로 status bar / home indicator 회피
// 데스크톱(md:+): 기존 핸드폰 미리보기 프레임(375x812 + 라운드 + 그림자) 유지
export function PageShell({ children }: PageShellProps) {
  return (
    <div className="flex min-h-dvh md:items-center md:justify-center md:bg-[#E7EAEE] md:p-6">
      <div className="relative flex min-h-dvh w-full flex-col overflow-hidden bg-white pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] md:h-[812px] md:min-h-0 md:w-[375px] md:rounded-[44px] md:shadow-[0_0_0_10px_#1A1D22,0_30px_60px_rgba(0,0,0,0.25)] md:pb-0 md:pt-0">
        {children}
      </div>
    </div>
  );
}
