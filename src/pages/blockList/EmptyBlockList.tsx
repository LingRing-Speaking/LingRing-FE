export function EmptyBlockList() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 pb-16">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
        <svg
          viewBox="0 0 24 24"
          className="h-7 w-7 text-gray-400"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="9" />
          <line x1="5" y1="5" x2="19" y2="19" />
        </svg>
      </div>
      <p className="m-0 text-[15px] font-semibold tracking-tight text-gray-800">
        아직 차단한 사용자가 없어요
      </p>
      <p className="m-0 text-center text-[13px] font-medium leading-[1.5] tracking-tight text-gray-500">
        상대 프로필에서 차단하면
        <br />이 목록에 보여요.
      </p>
    </div>
  );
}
