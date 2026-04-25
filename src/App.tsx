import { BrowserRouter, Route, Routes } from "react-router-dom";
import { QueryProvider } from "@/providers/QueryProvider";
import { MainPage } from "@/pages/main/MainPage";
import { MyPagePage } from "@/pages/mypage/MyPagePage";
import { UserExpressionsPage } from "@/pages/userExpressions/UserExpressionsPage";

export default function App() {
  return (
    <QueryProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<MainPage />} />
          <Route path="/mypage" element={<MyPagePage />} />
          <Route path="/expressions" element={<UserExpressionsPage />} />
        </Routes>
      </BrowserRouter>
    </QueryProvider>
  );
}
