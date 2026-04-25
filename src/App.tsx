import { QueryProvider } from "@/providers/QueryProvider";
import { MainPage } from "@/pages/main/MainPage";

export default function App() {
  return (
    <QueryProvider>
      <MainPage />
    </QueryProvider>
  );
}
