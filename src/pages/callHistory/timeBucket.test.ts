import { describe, expect, it } from "vitest";
import type { CallHistoryItem } from "@/domains/callHistory/types";
import { classifyCalls } from "./timeBucket";

function makeCall(startedAt: string, id = 1): CallHistoryItem {
  return {
    id,
    partner: { id: 1000 + id, name: `P${id}` },
    startedAt,
    durationSec: 60,
    analyzed: false,
  };
}

describe("classifyCalls", () => {
  // 기준: 2026-04-29(수) 14:00 KST. 이번 주 시작은 2026-04-27(월) 0시.
  const now = new Date(2026, 3, 29, 14, 0, 0); // 4월(=index 3) 29일 14:00

  it("같은 달력 날짜의 통화는 today 그룹", () => {
    const today0001 = new Date(2026, 3, 29, 0, 1, 0).toISOString();
    const todayLate = new Date(2026, 3, 29, 23, 30, 0).toISOString();
    const groups = classifyCalls(
      [makeCall(todayLate, 1), makeCall(today0001, 2)],
      now,
    );
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ bucket: "today", label: "오늘" });
    expect(groups[0]?.items).toHaveLength(2);
  });

  it("어제는 thisWeek 그룹 (today 와 분리)", () => {
    const yesterday2359 = new Date(2026, 3, 28, 23, 59, 0).toISOString();
    const today0001 = new Date(2026, 3, 29, 0, 1, 0).toISOString();
    const groups = classifyCalls(
      [makeCall(today0001, 1), makeCall(yesterday2359, 2)],
      now,
    );
    expect(groups).toHaveLength(2);
    expect(groups[0]?.bucket).toBe("today");
    expect(groups[1]).toMatchObject({ bucket: "thisWeek", label: "이번 주" });
  });

  it("이번 주 월요일 0시는 thisWeek, 그 직전(일요일 23:59)은 thisMonth/byMonth", () => {
    const mondayStart = new Date(2026, 3, 27, 0, 0, 0).toISOString();
    const sundayEnd = new Date(2026, 3, 26, 23, 59, 0).toISOString();
    const groups = classifyCalls(
      [makeCall(mondayStart, 1), makeCall(sundayEnd, 2)],
      now,
    );
    expect(groups[0]?.bucket).toBe("thisWeek");
    // 4월 26일은 이번 달이지만 이번 주 이전 → thisMonth
    expect(groups[1]?.bucket).toBe("thisMonth");
  });

  it("이번 달 1일은 thisMonth, 지난 달 마지막 날은 byMonth", () => {
    const aprilFirst = new Date(2026, 3, 1, 12, 0, 0).toISOString();
    const marchLast = new Date(2026, 2, 31, 23, 0, 0).toISOString();
    const groups = classifyCalls(
      [makeCall(aprilFirst, 1), makeCall(marchLast, 2)],
      now,
    );
    expect(groups[0]?.bucket).toBe("thisMonth");
    expect(groups[1]).toMatchObject({ bucket: "byMonth", label: "3월" });
  });

  it("서로 다른 byMonth 월은 별개 그룹으로 분리되고 라벨은 'M월'", () => {
    const marchCall = new Date(2026, 2, 15, 12, 0, 0).toISOString();
    const februaryCall = new Date(2026, 1, 10, 12, 0, 0).toISOString();
    const groups = classifyCalls(
      [makeCall(marchCall, 1), makeCall(februaryCall, 2)],
      now,
    );
    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({ bucket: "byMonth", label: "3월" });
    expect(groups[1]).toMatchObject({ bucket: "byMonth", label: "2월" });
  });

  it("빈 그룹은 결과에 포함하지 않는다 (오늘 통화가 없으면 today 헤더 없음)", () => {
    const yesterday = new Date(2026, 3, 28, 12, 0, 0).toISOString();
    const groups = classifyCalls([makeCall(yesterday, 1)], now);
    expect(groups.map((g) => g.bucket)).not.toContain("today");
  });

  it("입력 순서를 그대로 유지한다 (정렬은 서버 책임)", () => {
    const earlier = new Date(2026, 3, 29, 9, 0, 0).toISOString();
    const later = new Date(2026, 3, 29, 18, 0, 0).toISOString();
    const groups = classifyCalls(
      [makeCall(later, 1), makeCall(earlier, 2)],
      now,
    );
    expect(groups[0]?.items.map((i) => i.id)).toEqual([1, 2]);
  });

  it("빈 배열이면 빈 결과", () => {
    expect(classifyCalls([], now)).toEqual([]);
  });
});

import { formatCallMeta } from "./timeBucket";

describe("formatCallMeta", () => {
  const now = new Date(2026, 3, 29, 14, 0, 0); // 2026-04-29(수) 14:00

  it("오늘 오후 시각 포맷", () => {
    const startedAt = new Date(2026, 3, 29, 19, 30, 0);
    expect(formatCallMeta(startedAt, 323, now)).toBe("오늘 오후 7:30 · 5분 23초");
  });

  it("오늘 오전 시각 포맷 (자정 직후는 오전 12:01)", () => {
    const startedAt = new Date(2026, 3, 29, 0, 1, 0);
    expect(formatCallMeta(startedAt, 60, now)).toBe("오늘 오전 12:01 · 1분 0초");
  });

  it("정오는 오후 12:00", () => {
    const startedAt = new Date(2026, 3, 29, 12, 0, 0);
    expect(formatCallMeta(startedAt, 605, now)).toBe("오늘 오후 12:00 · 10분 5초");
  });

  it("이번 주 (어제 = 1일 전)", () => {
    const startedAt = new Date(2026, 3, 28, 12, 0, 0);
    expect(formatCallMeta(startedAt, 432, now)).toBe("1일 전 · 7분 12초");
  });

  it("최근 6일 이내 (3일 전)", () => {
    const startedAt = new Date(2026, 3, 26, 12, 0, 0);
    expect(formatCallMeta(startedAt, 432, now)).toBe("3일 전 · 7분 12초");
  });

  it("그 이전은 'M월 D일'", () => {
    const startedAt = new Date(2026, 3, 12, 12, 0, 0);
    expect(formatCallMeta(startedAt, 500, now)).toBe("4월 12일 · 8분 20초");
  });

  it("1분 미만이면 분 표기를 생략하고 '초'만 노출", () => {
    const startedAt = new Date(2026, 3, 29, 10, 0, 0);
    expect(formatCallMeta(startedAt, 9, now)).toBe("오늘 오전 10:00 · 9초");
  });

  it("긴 길이 (605초 → 10분 5초)", () => {
    const startedAt = new Date(2026, 3, 29, 10, 0, 0);
    expect(formatCallMeta(startedAt, 605, now)).toBe("오늘 오전 10:00 · 10분 5초");
  });

  it("1시간 정확히 (3600초 → '1시간')", () => {
    const startedAt = new Date(2026, 3, 29, 10, 0, 0);
    expect(formatCallMeta(startedAt, 3600, now)).toBe("오늘 오전 10:00 · 1시간");
  });

  it("1시간 + 분 (3700초 → '1시간 1분', 초는 생략)", () => {
    const startedAt = new Date(2026, 3, 29, 10, 0, 0);
    expect(formatCallMeta(startedAt, 3700, now)).toBe("오늘 오전 10:00 · 1시간 1분");
  });

  it("1시간 + 초만 (3641초 → '1시간', 분·초 생략)", () => {
    const startedAt = new Date(2026, 3, 29, 10, 0, 0);
    expect(formatCallMeta(startedAt, 3641, now)).toBe("오늘 오전 10:00 · 1시간");
  });

  it("2시간 + 분 (7320초 → '2시간 2분')", () => {
    const startedAt = new Date(2026, 3, 29, 10, 0, 0);
    expect(formatCallMeta(startedAt, 7320, now)).toBe("오늘 오전 10:00 · 2시간 2분");
  });
});
