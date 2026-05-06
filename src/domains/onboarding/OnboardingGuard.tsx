import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuthStore } from "@/domains/auth/store";

export function OnboardingGuard({ children }: { children: ReactNode }) {
  const requiresOnboarding = useAuthStore((state) => state.user?.requiresOnboarding);
  if (requiresOnboarding) return <Navigate to="/onboarding/terms" replace />;
  return <>{children}</>;
}
