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
  return { bucket: "byMonth", label: `${startedAt.getMonth() + 1}월` };
}

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
