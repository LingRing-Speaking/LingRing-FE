import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { PageShell } from "@/components/PageShell";
import { useUserId } from "@/domains/auth/hooks/useUserId";
import { useUserStats } from "@/domains/user/hooks/useUserStats";
import { useUserExpressions } from "@/domains/userExpression/hooks/useUserExpressions";
import { EmptyExpressions } from "./EmptyExpressions";
import { PhraseCard } from "./PhraseCard";

export function UserExpressionsPage() {
  const userId = useUserId();
  const expressions = useUserExpressions(userId);
  const userStats = useUserStats(userId);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const status = (() => {
    if (expressions.isError || userStats.isError) return "error";
    if (expressions.isPending || userStats.isPending) return "loading";
    return "success";
  })();

  const handleRetry = () => {
    expressions.refetch();
    userStats.refetch();
  };

  const items = expressions.data?.pages.flatMap((page) => page.items) ?? [];
  const totalCount = userStats.data?.expressionCount ?? 0;
  const isEmpty = items.length === 0;

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = expressions;
  useEffect(() => {
    if (status !== "success") return;
    if (!hasNextPage) return;

    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver((entries) => {
      const [entry] = entries;
      if (entry?.isIntersecting && !isFetchingNextPage) {
        fetchNextPage();
      }
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [status, hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <PageShell>
      <main className="relative flex flex-1 flex-col bg-gray-50">
        <div className="relative z-[2] flex h-12 items-center bg-gray-50 px-3">
          <Link
            to="/mypage"
            aria-label="뒤로 가기"
            className="flex h-10 w-10 items-center justify-center rounded-full text-gray-700"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </Link>
        </div>

        <header className="bg-gray-50 px-6 pb-4 pt-1">
          <h1 className="m-0 text-[24px] font-extrabold leading-[1.3] tracking-[-0.02em] text-gray-900">
            저장한 표현
          </h1>
          <p className="mt-1.5 text-[13.5px] font-medium leading-none tracking-[-0.01em] text-gray-500 tabular-nums">
            총 {totalCount}개
          </p>
        </header>

        {status === "loading" && (
          <div className="flex flex-1 items-center justify-center">
            <div
              role="status"
              aria-label="로딩 중"
              className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-mint-500"
            />
          </div>
        )}

        {status === "error" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4">
            <p className="text-[15px] font-medium text-gray-700">정보를 불러오지 못했어요.</p>
            <button
              type="button"
              onClick={handleRetry}
              className="rounded-md bg-mint-500 px-5 py-2.5 text-[14px] font-semibold text-white"
            >
              다시 시도
            </button>
          </div>
        )}

        {status === "success" && isEmpty && <EmptyExpressions />}

        {status === "success" && !isEmpty && (
          <div className="scrollbar-none flex-1 overflow-y-auto px-5 pb-8 pt-1">
            <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
              {items.map((item) => (
                <PhraseCard key={item.id} expression={item.expression} meaning={item.meaning} />
              ))}
            </ul>
            <div ref={sentinelRef} aria-hidden="true" className="h-1" />
          </div>
        )}
      </main>
    </PageShell>
  );
}
