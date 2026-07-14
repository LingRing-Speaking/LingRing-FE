import { describe, it, expect } from "vitest";
import { validateNickname } from "@/domains/user/nickname";
import { generateNickname } from "./nickname";

describe("generateNickname", () => {
  it("한글형용사+한글동물+두자리숫자 패턴을 따른다", () => {
    expect(generateNickname()).toMatch(/^[가-힣]+\d{2}$/);
  });

  it("항상 닉네임 검증 규칙(2~12자 한영숫자)을 통과한다", () => {
    const SAMPLE_SIZE = 500;
    for (let i = 0; i < SAMPLE_SIZE; i += 1) {
      const nickname = generateNickname();
      expect(validateNickname(nickname)).toEqual({ ok: true, value: nickname });
    }
  });

  it("100회 호출 시 대부분 다른 값을 만든다", () => {
    const NICKNAME_SAMPLE_SIZE = 100;
    const UNIQUE_LOWER_BOUND = 80;
    const set = new Set(Array.from({ length: NICKNAME_SAMPLE_SIZE }, () => generateNickname()));
    expect(set.size).toBeGreaterThan(UNIQUE_LOWER_BOUND);
  });
});
