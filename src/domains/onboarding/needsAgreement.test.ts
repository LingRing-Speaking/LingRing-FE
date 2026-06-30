import { describe, expect, it } from "vitest";
import { LEGAL_TERMS_VERSION } from "@/config/legal";
import { needsAgreement } from "./needsAgreement";

describe("needsAgreement", () => {
  it("한 번도 동의하지 않았으면(requiresOnboarding) true", () => {
    expect(needsAgreement({ requiresOnboarding: true })).toBe(true);
  });

  it("동의한 버전이 현재 시행 버전과 같으면 false", () => {
    expect(
      needsAgreement({
        requiresOnboarding: false,
        agreedTermsVersion: LEGAL_TERMS_VERSION,
      }),
    ).toBe(false);
  });

  it("동의한 버전이 현재 시행 버전과 다르면 재동의 필요 → true", () => {
    expect(
      needsAgreement({
        requiresOnboarding: false,
        agreedTermsVersion: "1900-01-01",
      }),
    ).toBe(true);
  });

  it("agreedTermsVersion이 없으면(구버전 응답) 재동의 루프 방지를 위해 false", () => {
    expect(needsAgreement({ requiresOnboarding: false })).toBe(false);
    expect(
      needsAgreement({ requiresOnboarding: false, agreedTermsVersion: null }),
    ).toBe(false);
  });
});
