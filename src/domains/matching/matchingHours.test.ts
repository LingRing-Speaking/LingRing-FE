import { describe, expect, it } from "vitest";
import { isMatchingOpen, msUntilMatchingHoursChange } from "./matchingHours";

const kst = (time: string) => new Date(`2026-10-03T${time}+09:00`);
const HOUR_MS = 60 * 60 * 1000;

describe("isMatchingOpen", () => {
  it.each([
    ["19:59:59", false],
    ["20:00:00", true],
    ["22:59:59", true],
    ["23:00:00", false],
    ["02:00:00", false],
  ])("KST %s 이면 %s", (time, expected) => {
    expect(isMatchingOpen(kst(time))).toBe(expected);
  });

  it("기기 시간대와 무관하게 KST 로 판정한다 (UTC 11:30 = KST 20:30)", () => {
    expect(isMatchingOpen(new Date("2026-10-03T11:30:00Z"))).toBe(true);
  });
});

describe("msUntilMatchingHoursChange", () => {
  it("열리기 전이면 오늘 20:00 까지 남은 시간", () => {
    expect(msUntilMatchingHoursChange(kst("19:00:00"))).toBe(HOUR_MS);
  });

  it("열려 있으면 23:00 까지 남은 시간", () => {
    expect(msUntilMatchingHoursChange(kst("21:30:00"))).toBe(1.5 * HOUR_MS);
  });

  it("닫힌 뒤면 다음 날 20:00 까지 남은 시간", () => {
    expect(msUntilMatchingHoursChange(kst("23:30:00"))).toBe(20.5 * HOUR_MS);
  });

  it("경계 시각 정각이면 다음 경계까지 남은 시간", () => {
    expect(msUntilMatchingHoursChange(kst("20:00:00"))).toBe(3 * HOUR_MS);
  });
});
