import { useEffect } from "react";
import { BrowserRouter, Outlet, Route, Routes } from "react-router-dom";
import { QueryProvider } from "@/providers/QueryProvider";
import { recoveryRun } from "@/domains/call/recording/recordingRecovery";
import { AuthGuard } from "@/domains/auth/AuthGuard";
import { OnboardingGuard } from "@/domains/onboarding/OnboardingGuard";
import { LoginPage } from "@/pages/login/LoginPage";
import { MainPage } from "@/pages/main/MainPage";
import { MatchingPage } from "@/pages/matching/MatchingPage";
import { CallPage } from "@/pages/call/CallPage";
import { MyPagePage } from "@/pages/mypage/MyPagePage";
import { SplashPage } from "@/pages/splash/SplashPage";
// 저장한 표현 기능 미출시 — 라우트 자체를 비활성화하여 진입을 원천 차단.
// 출시 시 import 와 Route 복원.
// import { UserExpressionsPage } from "@/pages/userExpressions/UserExpressionsPage";
import { BlockListPage } from "@/pages/blockList/BlockListPage";
import { CallHistoryPage } from "@/pages/callHistory/CallHistoryPage";
import { AnalysisResultPage } from "@/pages/analysis/AnalysisResultPage";
import { SettingsPage } from "@/pages/settings/SettingsPage";
import { WithdrawPage } from "@/pages/withdraw/WithdrawPage";
import { OnboardingTermsPage } from "@/pages/onboarding/OnboardingTermsPage";
import { OnboardingNicknamePage } from "@/pages/onboarding/OnboardingNicknamePage";

function AuthenticatedRoutes() {
  return (
    <AuthGuard>
      <Outlet />
    </AuthGuard>
  );
}

function OnboardedRoutes() {
  return (
    <OnboardingGuard>
      <Outlet />
    </OnboardingGuard>
  );
}

export default function App() {
  useEffect(() => {
    // 앱 mount 시 1 회 — 이전 통화에서 업로드 못 끝낸 잔여 녹음 파일 재시도.
    void recoveryRun();
  }, []);

  return (
    <QueryProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<SplashPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route element={<AuthenticatedRoutes />}>
            <Route path="/onboarding/terms" element={<OnboardingTermsPage />} />
            <Route path="/onboarding/nickname" element={<OnboardingNicknamePage />} />
            <Route element={<OnboardedRoutes />}>
              <Route path="/home" element={<MainPage />} />
              <Route path="/matching" element={<MatchingPage />} />
              <Route path="/call/:roomId" element={<CallPage />} />
              <Route path="/mypage" element={<MyPagePage />} />
              {/* <Route path="/expressions" element={<UserExpressionsPage />} /> — 미출시 */}
              <Route path="/history" element={<CallHistoryPage />} />
              <Route path="/analyses/:analysisId" element={<AnalysisResultPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/settings/blocks" element={<BlockListPage />} />
              <Route path="/settings/withdraw" element={<WithdrawPage />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryProvider>
  );
}
