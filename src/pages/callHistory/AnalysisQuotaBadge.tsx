import type { AnalysisQuota } from "@/domains/callHistory/types";

type Props = {
  quota: AnalysisQuota | undefined;
};

/**
 * 통화 기록 상단의 분석 티켓 잔여 배지. 매일 0시 충전되는 무료 "일반티켓"(민트)과
 * 지급·구매된 "황금티켓"(골드)을 각각 칩으로 보여준다. quota 가 아직 없으면(로딩·
 * 오류) 레이아웃 흔들림을 막기 위해 스켈레톤을 자리만 잡아 둔다.
 */
export function AnalysisQuotaBadge({ quota }: Props) {
  if (!quota) return <QuotaBadgeSkeleton />;

  return (
    <div className="flex items-center gap-2" aria-label="분석 티켓 잔여">
      <TicketChip tone="free" label="일반티켓" count={quota.freeTicket} />
      <TicketChip tone="gold" label="황금티켓" count={quota.paidTicket} />
    </div>
  );
}

const TONE_STYLE = {
  free: "bg-mint-50 text-mint-600",
  gold: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
} as const;

function TicketChip({
  tone,
  label,
  count,
}: {
  tone: keyof typeof TONE_STYLE;
  label: string;
  count: number;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-bold leading-none tracking-tight ${TONE_STYLE[tone]}`}
    >
      <TicketIcon className="h-4 w-4 flex-shrink-0" />
      {label}
      <span className="tabular-nums">{count}장</span>
    </span>
  );
}

export function TicketIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M4 7.5A1.5 1.5 0 0 1 5.5 6h13A1.5 1.5 0 0 1 20 7.5V9a1.5 1.5 0 0 0 0 3v1.5A1.5 1.5 0 0 1 18.5 18h-13A1.5 1.5 0 0 1 4 16.5V15a1.5 1.5 0 0 0 0-3V7.5Z" />
      <path d="M13.5 6v12" strokeDasharray="2 2.4" />
    </svg>
  );
}

function QuotaBadgeSkeleton() {
  return (
    <div className="flex items-center gap-2" aria-hidden="true">
      <span className="h-[30px] w-[96px] animate-pulse rounded-full bg-gray-100" />
      <span className="h-[30px] w-[96px] animate-pulse rounded-full bg-gray-100" />
    </div>
  );
}
