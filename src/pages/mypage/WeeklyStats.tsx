type Props = {
  currentStreakDays: number;
  totalCallCount: number;
};

export function WeeklyStats({ currentStreakDays, totalCallCount }: Props) {
  return (
    <>
      <h3 className="mx-1 mb-3 mt-7 text-[15px] font-bold tracking-tight text-gray-800">
        이번 주 학습 현황
      </h3>
      <div className="mb-1.5 grid grid-cols-2 gap-2.5">
        <div className="flex flex-col gap-0.5 rounded-[18px] bg-white px-[18px] pt-[18px] pb-5 shadow-card">
          <span aria-hidden="true" className="mb-1.5 text-[22px] leading-none">
            🔥
          </span>
          <span className="text-[24px] font-extrabold leading-[1.15] tracking-[-0.03em] text-gray-900 tabular-nums">
            {currentStreakDays}
            <span className="ml-0.5 text-[15px] font-bold text-gray-700">
              일
            </span>
          </span>
          <span className="mt-1 text-[12.5px] font-medium text-gray-600">
            연속 학습
          </span>
        </div>
        <div className="flex flex-col gap-0.5 rounded-[18px] bg-white px-[18px] pt-[18px] pb-5 shadow-card">
          <span aria-hidden="true" className="mb-1.5 text-[22px] leading-none">
            💬
          </span>
          <span className="text-[24px] font-extrabold leading-[1.15] tracking-[-0.03em] text-gray-900 tabular-nums">
            {totalCallCount}
            <span className="ml-0.5 text-[15px] font-bold text-gray-700">
              회
            </span>
          </span>
          <span className="mt-1 text-[12.5px] font-medium text-gray-600">
            누적 통화
          </span>
        </div>
      </div>
      <p className="mb-4 ml-1 text-[11.5px] font-medium leading-none tracking-tight text-gray-400">
        ⓘ 1분 이상 통화부터 집계돼요
      </p>
    </>
  );
}
