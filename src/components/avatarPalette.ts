// 브랜드 토큰(mint/coral) 안에서 5가지 폴백 그라데이션. Tailwind가 정적 분석할 수
// 있도록 각 항목은 동적 합성이 아닌 완전한 클래스 리터럴.
export const FALLBACK_GRADIENTS = [
  "from-mint-400 to-mint-600",
  "from-mint-200 to-mint-400",
  "from-coral-300 to-coral-500",
  "from-coral-500 to-coral-600",
  "from-mint-400 to-coral-500",
] as const;

function hashName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function gradientForName(name: string): string {
  return FALLBACK_GRADIENTS[hashName(name) % FALLBACK_GRADIENTS.length];
}
