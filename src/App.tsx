import { QueryProvider } from "@/providers/QueryProvider";
import { MyPagePage } from "@/pages/mypage/MyPagePage";

export default function App() {
  return (
    <QueryProvider>
      <MyPagePage />
    </QueryProvider>
  );
}
