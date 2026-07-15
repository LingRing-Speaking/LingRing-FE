import { Link } from "react-router-dom";

export function MyRecords() {
  return (
    <>
      <h3 className="mx-1 mb-3 mt-7 text-[15px] font-bold tracking-tight text-gray-800">
        내 기록
      </h3>
      <div className="mb-4 overflow-hidden rounded-[18px] bg-white shadow-card">
        <Link
          to="/expressions"
          className="flex w-full items-center gap-3.5 px-5 py-4 text-left transition-colors active:bg-gray-50"
        >
          <span
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-mint-50 text-lg"
          >
            📝
          </span>
          <span className="flex-1 text-[15px] font-semibold leading-tight tracking-tight text-gray-800">
            저장한 표현
          </span>
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="h-5 w-5 shrink-0 text-gray-300"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </Link>
      </div>
    </>
  );
}
