import { describe, it, expect } from "vitest";
import { generateNickname } from "./nickname";

describe("generateNickname", () => {
  it("형용사-동물-네자리숫자 패턴을 따른다", () => {
    expect(generateNickname()).toMatch(/^[a-z]+-[a-z]+-\d{4}$/);
  });

  it("100회 호출 시 대부분 다른 값을 만든다", () => {
    const NICKNAME_SAMPLE_SIZE = 100;
    const UNIQUE_LOWER_BOUND = 80;
    const set = new Set(Array.from({ length: NICKNAME_SAMPLE_SIZE }, () => generateNickname()));
    expect(set.size).toBeGreaterThan(UNIQUE_LOWER_BOUND);
  });
});
