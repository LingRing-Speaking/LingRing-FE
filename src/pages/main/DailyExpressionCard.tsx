import { todayKstDateString } from "@/domains/recommendedExpression/hooks/useDailyRecommendedExpression";
import type { DailyRecommendedExpression } from "@/domains/recommendedExpression/types";
import { BookmarkStarButton } from "@/domains/userExpression/components/BookmarkStarButton";
import { useToggleBookmark } from "@/domains/userExpression/hooks/useToggleBookmark";

type Props = { data: DailyRecommendedExpression | null };

export function DailyExpressionCard({ data }: Props) {
  return (
    <article className="mb-5 flex w-full items-start gap-3.5 rounded-[20px] border border-gray-100 bg-white p-[18px_20px] text-left shadow-card">
      <div
        aria-hidden="true"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-gradient-to-br from-mint-100 to-coral-100 text-[20px]"
      >
        💬
      </div>
      <div className="min-w-0 flex-1">
        <p className="m-0 mb-1 text-[12px] font-semibold leading-[1.4] tracking-[0.02em] text-mint-600">
          오늘의 표현
        </p>
        {data ? (
          <>
            <p className="m-0 mb-0.5 text-[17px] font-semibold leading-[1.4] tracking-[-0.01em] text-gray-900">
              &ldquo;{data.expression}&rdquo;
            </p>
            <p className="m-0 text-[13px] font-medium leading-[1.5] text-gray-600">
              {data.meaning}
            </p>
          </>
        ) : (
          <p className="m-0 text-[17px] font-semibold leading-[1.4] tracking-[-0.01em] text-gray-700">
            오늘의 표현을 준비 중이에요
          </p>
        )}
      </div>
      {data && <DailyBookmarkStar data={data} />}
    </article>
  );
}

function DailyBookmarkStar({ data }: { data: DailyRecommendedExpression }) {
  const { toggle, isPending } = useToggleBookmark<DailyRecommendedExpression | null>(
    {
      queryKey: ["recommendedExpression", "daily", todayKstDateString()],
      patch: (current, nextBookmarkId) =>
        current ? { ...current, bookmarkId: nextBookmarkId } : current,
    },
  );

  return (
    <div className="self-center">
      <BookmarkStarButton
        active={data.bookmarkId !== null}
        pending={isPending}
        onToggle={() =>
          toggle(data.bookmarkId, {
            source: "DAILY_EXPRESSION",
            recommendedExpressionId: data.id,
          })
        }
      />
    </div>
  );
}
