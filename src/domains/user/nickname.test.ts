import { describe, expect, it } from "vitest";
import { MAX_NICKNAME_LENGTH, MIN_NICKNAME_LENGTH, validateNickname } from "./nickname";

describe("validateNickname", () => {
  it("빈 값(공백만 포함)은 입력 안내 사유로 거부한다", () => {
    const result = validateNickname("   ");
    expect(result).toEqual({ ok: false, reason: "닉네임을 입력해주세요." });
  });

  it(`${MIN_NICKNAME_LENGTH}자 미만은 길이 사유로 거부한다`, () => {
    const result = validateNickname("a");
    expect(result).toEqual({
      ok: false,
      reason: `닉네임은 ${MIN_NICKNAME_LENGTH}~${MAX_NICKNAME_LENGTH}자여야 해요.`,
    });
  });

  it(`${MAX_NICKNAME_LENGTH}자 초과는 길이 사유로 거부한다`, () => {
    const tooLong = "a".repeat(MAX_NICKNAME_LENGTH + 1);
    const result = validateNickname(tooLong);
    expect(result).toEqual({
      ok: false,
      reason: `닉네임은 ${MIN_NICKNAME_LENGTH}~${MAX_NICKNAME_LENGTH}자여야 해요.`,
    });
  });

  it("특수문자·공백이 섞이면 문자셋 사유로 거부한다", () => {
    expect(validateNickname("hi!")).toEqual({
      ok: false,
      reason: "특수문자나 공백은 사용할 수 없어요.",
    });
    expect(validateNickname("hi there")).toEqual({
      ok: false,
      reason: "특수문자나 공백은 사용할 수 없어요.",
    });
  });

  it("한글 닉네임을 통과시킨다", () => {
    expect(validateNickname("링링유저")).toEqual({ ok: true, value: "링링유저" });
  });

  it("영문·숫자 조합을 통과시키고 앞뒤 공백은 제거한 값을 돌려준다", () => {
    expect(validateNickname("  lingring2 ")).toEqual({ ok: true, value: "lingring2" });
  });

  it(`경계값 ${MIN_NICKNAME_LENGTH}자·${MAX_NICKNAME_LENGTH}자를 통과시킨다`, () => {
    const min = "가".repeat(MIN_NICKNAME_LENGTH);
    const max = "b".repeat(MAX_NICKNAME_LENGTH);
    expect(validateNickname(min)).toEqual({ ok: true, value: min });
    expect(validateNickname(max)).toEqual({ ok: true, value: max });
  });
});
