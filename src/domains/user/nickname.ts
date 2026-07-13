export const MIN_NICKNAME_LENGTH = 2;
export const MAX_NICKNAME_LENGTH = 12;

// 완성형 한글 · 영문 대소문자 · 숫자만 허용 (공백·특수문자 불가).
const NICKNAME_PATTERN = /^[가-힣a-zA-Z0-9]+$/;

export type NicknameCheck =
  | { ok: true; value: string }
  | { ok: false; reason: string };

/**
 * 사용자가 입력한 닉네임의 유효성을 검증한다.
 * 성공 시 앞뒤 공백을 제거한 정규화된 값을 함께 돌려주므로, 호출자는 result.value 를 그대로 제출한다.
 */
export function validateNickname(raw: string): NicknameCheck {
  const value = raw.trim();
  if (value.length === 0) return { ok: false, reason: "닉네임을 입력해주세요." };
  if (value.length < MIN_NICKNAME_LENGTH || value.length > MAX_NICKNAME_LENGTH) {
    return {
      ok: false,
      reason: `닉네임은 ${MIN_NICKNAME_LENGTH}~${MAX_NICKNAME_LENGTH}자여야 해요.`,
    };
  }
  if (!NICKNAME_PATTERN.test(value)) {
    return { ok: false, reason: "특수문자나 공백은 사용할 수 없어요." };
  }
  return { ok: true, value };
}
