import { BrowserRouter, Route, Routes } from "react-router-dom";
import { QueryProvider } from "@/providers/QueryProvider";
import { MainPage } from "@/pages/main/MainPage";
import { MatchingPage } from "@/pages/matching/MatchingPage";
import { CallPage } from "@/pages/call/CallPage";
import { MyPagePage } from "@/pages/mypage/MyPagePage";
import { UserExpressionsPage } from "@/pages/userExpressions/UserExpressionsPage";
import { CallHistoryPage } from "@/pages/callHistory/CallHistoryPage";

export default function App() {
  return (
    <QueryProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<MainPage />} />
          <Route path="/matching" element={<MatchingPage />} />
          <Route path="/call/:roomId" element={<CallPage />} />
          <Route path="/mypage" element={<MyPagePage />} />
          <Route path="/expressions" element={<UserExpressionsPage />} />
          <Route path="/history" element={<CallHistoryPage />} />
        </Routes>
      </BrowserRouter>
    </QueryProvider>
  );
}
