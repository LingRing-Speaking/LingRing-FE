const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
// 한국은 서머타임이 없어 UTC+9 로 고정 계산한다. 기기 시간대와 무관하게 모두 같은 시간대에 모이게 한다.
const KST_OFFSET_MS = 9 * HOUR_MS;
const OPEN_AT_MS = 20 * HOUR_MS;
const CLOSE_AT_MS = 23 * HOUR_MS;

function kstMsOfDay(now: Date): number {
  return (((now.getTime() + KST_OFFSET_MS) % DAY_MS) + DAY_MS) % DAY_MS;
}

/** 랜덤 매칭은 KST 20:00 이상 23:00 미만에만 열린다. */
export function isMatchingOpen(now: Date): boolean {
  const msOfDay = kstMsOfDay(now);
  return msOfDay >= OPEN_AT_MS && msOfDay < CLOSE_AT_MS;
}

/** 다음 열림(20:00)·닫힘(23:00) 경계까지 남은 ms. */
export function msUntilMatchingHoursChange(now: Date): number {
  const msOfDay = kstMsOfDay(now);
  if (msOfDay < OPEN_AT_MS) return OPEN_AT_MS - msOfDay;
  if (msOfDay < CLOSE_AT_MS) return CLOSE_AT_MS - msOfDay;
  return DAY_MS - msOfDay + OPEN_AT_MS;
}
