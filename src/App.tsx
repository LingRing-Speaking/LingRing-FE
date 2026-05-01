import { BrowserRouter, Outlet, Route, Routes } from "react-router-dom";
import { QueryProvider } from "@/providers/QueryProvider";
import { AuthGuard } from "@/domains/auth/AuthGuard";
import { LoginPage } from "@/pages/login/LoginPage";
import { MainPage } from "@/pages/main/MainPage";
import { MatchingPage } from "@/pages/matching/MatchingPage";
import { CallPage } from "@/pages/call/CallPage";
import { MyPagePage } from "@/pages/mypage/MyPagePage";
import { SplashPage } from "@/pages/splash/SplashPage";
import { UserExpressionsPage } from "@/pages/userExpressions/UserExpressionsPage";
import { CallHistoryPage } from "@/pages/callHistory/CallHistoryPage";

function ProtectedRoutes() {
  return (
    <AuthGuard>
      <Outlet />
    </AuthGuard>
  );
}

export default function App() {
  return (
    <QueryProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<SplashPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoutes />}>
            <Route path="/home" element={<MainPage />} />
            <Route path="/matching" element={<MatchingPage />} />
            <Route path="/call/:roomId" element={<CallPage />} />
            <Route path="/mypage" element={<MyPagePage />} />
            <Route path="/expressions" element={<UserExpressionsPage />} />
            <Route path="/history" element={<CallHistoryPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryProvider>
  );
}
