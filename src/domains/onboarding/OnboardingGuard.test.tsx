import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Route, Routes } from "react-router-dom";
import { renderWithQueryClient } from "../../../test/utils/renderWithQueryClient";
import { OnboardingGuard } from "./OnboardingGuard";

function renderRoutes(initialEntry: string, user: { requiresOnboarding?: boolean }) {
  return renderWithQueryClient(
    <Routes>
      <Route path="/onboarding/terms" element={<div>온보딩 약관</div>} />
      <Route
        path="/home"
        element={
          <OnboardingGuard>
            <div>홈 화면</div>
          </OnboardingGuard>
        }
      />
    </Routes>,
    {
      user: { id: 1, nickname: "tester", profileImage: null, ...user },
      initialEntries: [initialEntry],
    },
  );
}

describe("OnboardingGuard", () => {
  it("requiresOnboarding이 true면 /onboarding/terms로 리다이렉트", () => {
    renderRoutes("/home", { requiresOnboarding: true });
    expect(screen.getByText("온보딩 약관")).toBeInTheDocument();
    expect(screen.queryByText("홈 화면")).not.toBeInTheDocument();
  });

  it("requiresOnboarding이 false면 children을 렌더", () => {
    renderRoutes("/home", { requiresOnboarding: false });
    expect(screen.getByText("홈 화면")).toBeInTheDocument();
  });

  it("requiresOnboarding이 undefined(기존 BE 응답)면 children을 렌더", () => {
    renderRoutes("/home", {});
    expect(screen.getByText("홈 화면")).toBeInTheDocument();
  });
});
