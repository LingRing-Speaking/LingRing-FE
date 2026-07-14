const MAX_DISPLAY = 99;

type Props = {
  count: number;
  className?: string;
};

// 받은 요청 개수 뱃지(코랄 pill). count 가 0 이하면 아무것도 렌더하지 않는다.
export function CountBadge({ count, className = "" }: Props) {
  if (count <= 0) return null;
  const label = count > MAX_DISPLAY ? `${MAX_DISPLAY}+` : String(count);

  return (
    <span
      className={`inline-flex min-w-[18px] items-center justify-center rounded-full bg-coral-500 px-1.5 text-[11px] font-bold leading-[18px] text-white ${className}`}
    >
      {label}
    </span>
  );
}
