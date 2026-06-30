import { LEGAL_TERMS_VERSION } from "@/config/legal";
import type { User } from "@/domains/auth/types";

/**
 * 온보딩(최초 동의) 또는 약관 버전 변경에 따른 재동의가 필요한지 판단한다.
 * - 한 번도 동의하지 않음(requiresOnboarding) → 필요
 * - 동의했으나 동의한 버전이 현재 시행 버전과 다름 → 재동의 필요
 *
 * agreedTermsVersion이 비어있으면(구버전 BE 응답 등) 재동의 루프를 막기 위해 강제하지 않는다.
 */
export function needsAgreement(
  user: Pick<User, "requiresOnboarding" | "agreedTermsVersion">,
): boolean {
  if (user.requiresOnboarding) return true;
  return (
    !!user.agreedTermsVersion && user.agreedTermsVersion !== LEGAL_TERMS_VERSION
  );
}
