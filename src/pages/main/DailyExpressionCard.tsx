import type { DailyRecommendedExpression } from "@/domains/recommendedExpression/types";

type Props = { data: DailyRecommendedExpression | null };

export function DailyExpressionCard({ data }: Props) {
  return (
    <button
      type="button"
      disabled
      aria-disabled="true"
      aria-label="오늘의 표현 자세히 보기"
      className="mb-5 flex w-full cursor-not-allowed items-start gap-3.5 rounded-[20px] border border-gray-100 bg-white p-[18px_20px] text-left shadow-card"
    >
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
      {data && (
        <span aria-hidden="true" className="self-center text-[20px] text-gray-400">
          ›
        </span>
      )}
    </button>
  );
}
