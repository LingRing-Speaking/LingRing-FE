import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuthStore } from "@/domains/auth/store";
import { needsAgreement } from "@/domains/onboarding/needsAgreement";

export function OnboardingGuard({ children }: { children: ReactNode }) {
  const user = useAuthStore((state) => state.user);
  if (user && needsAgreement(user)) return <Navigate to="/onboarding/terms" replace />;
  return <>{children}</>;
}
