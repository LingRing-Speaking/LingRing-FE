import { useEffect } from "react";
import { BrowserRouter, Outlet, Route, Routes } from "react-router-dom";
import { QueryProvider } from "@/providers/QueryProvider";
import { recoveryRun } from "@/domains/call/recording/recordingRecovery";
import { usePresenceHeartbeat } from "@/domains/presence/hooks/usePresenceHeartbeat";
import { IncomingInvitationBanner } from "@/domains/matching/components/IncomingInvitationBanner";
import { AuthGuard } from "@/domains/auth/AuthGuard";
import { OnboardingGuard } from "@/domains/onboarding/OnboardingGuard";
import { LoginPage } from "@/pages/login/LoginPage";
import { MainPage } from "@/pages/main/MainPage";
import { MatchingPage } from "@/pages/matching/MatchingPage";
import { CallInvitePage } from "@/pages/callInvite/CallInvitePage";
import { CallPage } from "@/pages/call/CallPage";
import { MyPagePage } from "@/pages/mypage/MyPagePage";
import { FriendsPage } from "@/pages/friends/FriendsPage";
import { FriendRequestsPage } from "@/pages/friends/FriendRequestsPage";
import { FriendSearchPage } from "@/pages/friends/FriendSearchPage";
import { SplashPage } from "@/pages/splash/SplashPage";
import { UserExpressionsPage } from "@/pages/userExpressions/UserExpressionsPage";
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
  // 로그인~로그아웃, 포그라운드~백그라운드에 묶인 온라인 하트비트. 앱 전역 1회 마운트.
  usePresenceHeartbeat();

  useEffect(() => {
    // 앱 mount 시 1 회 — 이전 통화에서 업로드 못 끝낸 잔여 녹음 파일 재시도.
    void recoveryRun();
  }, []);

  return (
    <QueryProvider>
      <BrowserRouter>
        {/* 수신 통화 초대 배너 (#213) — 어느 화면 위에서든 뜨도록 라우트 밖에 전역 1회 마운트 */}
        <IncomingInvitationBanner />
        <Routes>
          <Route path="/" element={<SplashPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route element={<AuthenticatedRoutes />}>
            <Route path="/onboarding/terms" element={<OnboardingTermsPage />} />
            <Route path="/onboarding/nickname" element={<OnboardingNicknamePage />} />
            <Route element={<OnboardedRoutes />}>
              <Route path="/home" element={<MainPage />} />
              <Route path="/friends" element={<FriendsPage />} />
              <Route path="/friends/requests" element={<FriendRequestsPage />} />
              <Route path="/friends/search" element={<FriendSearchPage />} />
              <Route path="/matching" element={<MatchingPage />} />
              <Route path="/call-invite/:inviteeId" element={<CallInvitePage />} />
              <Route path="/call/:roomId" element={<CallPage />} />
              <Route path="/mypage" element={<MyPagePage />} />
              <Route path="/expressions" element={<UserExpressionsPage />} />
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
