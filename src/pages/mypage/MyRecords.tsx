// 저장한 표현 기능은 미출시 — 진입 동선을 막아 사용자가 빈 페이지에 도달하지 않도록 한다.
// 출시 시 disabled 제거 + Link 로 복원.
export function MyRecords() {
  return (
    <>
      <h3 className="mx-1 mb-3 mt-7 text-[15px] font-bold tracking-tight text-gray-800">
        내 기록
      </h3>
      <div className="mb-4 overflow-hidden rounded-[18px] bg-white shadow-card">
        <div
          aria-disabled="true"
          className="flex w-full items-center gap-3.5 px-5 py-4 text-left"
        >
          <span
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-gray-100 text-lg opacity-60"
          >
            📝
          </span>
          <span className="flex-1 text-[15px] font-semibold leading-tight tracking-tight text-gray-400">
            저장한 표현
          </span>
          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-bold leading-none tracking-tight text-gray-500">
            준비 중
          </span>
        </div>
      </div>
    </>
  );
}
