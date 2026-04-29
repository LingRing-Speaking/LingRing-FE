import type { CallHistoryItem } from "@/domains/callHistory/types";

export type Bucket = "today" | "thisWeek" | "thisMonth" | "byMonth";

export type CallGroup = {
  bucket: Bucket;
  label: string;
  items: CallHistoryItem[];
};

function isSameDate(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function startOfWeekMonday(d: Date): Date {
  const day = d.getDay(); // 0=일 ... 6=토
  const diffToMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  monday.setDate(monday.getDate() - diffToMonday);
  return monday;
}

function classify(
  startedAt: Date,
  now: Date,
): { bucket: Bucket; label: string } {
  if (isSameDate(startedAt, now)) {
    return { bucket: "today", label: "오늘" };
  }
  const weekStart = startOfWeekMonday(now);
  if (startedAt >= weekStart) {
    return { bucket: "thisWeek", label: "이번 주" };
  }
  if (
    startedAt.getFullYear() === now.getFullYear() &&
    startedAt.getMonth() === now.getMonth()
  ) {
    return { bucket: "thisMonth", label: "이번 달" };
  }
  // 라벨에 연도는 포함하지 않는다 — 목업이 그렇고, 1년 이상 사용 시 보강은 후속 작업
  return { bucket: "byMonth", label: `${startedAt.getMonth() + 1}월` };
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function formatDuration(durationSec: number): string {
  const m = Math.floor(durationSec / 60);
  const s = durationSec % 60;
  return `${m}:${pad2(s)}`;
}

function formatTimeOfDay(d: Date): string {
  const h24 = d.getHours();
  const meridiem = h24 < 12 ? "오전" : "오후";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${meridiem} ${h12}:${pad2(d.getMinutes())}`;
}

function diffInDays(later: Date, earlier: Date): number {
  const a = new Date(later.getFullYear(), later.getMonth(), later.getDate());
  const b = new Date(
    earlier.getFullYear(),
    earlier.getMonth(),
    earlier.getDate(),
  );
  return Math.round((a.getTime() - b.getTime()) / 86_400_000);
}

export function formatCallMeta(
  startedAt: Date,
  durationSec: number,
  now: Date,
): string {
  const duration = formatDuration(durationSec);
  if (isSameDate(startedAt, now)) {
    return `오늘 ${formatTimeOfDay(startedAt)} · ${duration}`;
  }
  const days = diffInDays(now, startedAt);
  if (days <= 6) {
    return `${days}일 전 · ${duration}`;
  }
  return `${startedAt.getMonth() + 1}월 ${startedAt.getDate()}일 · ${duration}`;
}

// 입력 배열의 순서를 그대로 유지한다. 시간 내림차순 정렬은 서버 책임.
export function classifyCalls(
  items: CallHistoryItem[],
  now: Date,
): CallGroup[] {
  const groups: CallGroup[] = [];
  for (const item of items) {
    const startedAt = new Date(item.startedAt);
    const { bucket, label } = classify(startedAt, now);
    const last = groups[groups.length - 1];
    if (last && last.bucket === bucket && last.label === label) {
      last.items.push(item);
    } else {
      groups.push({ bucket, label, items: [item] });
    }
  }
  return groups;
}
