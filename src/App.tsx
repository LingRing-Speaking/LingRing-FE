import { QueryProvider } from "@/providers/QueryProvider";
import { UserExpressionsPage } from "@/pages/userExpressions/UserExpressionsPage";

export default function App() {
  return (
    <QueryProvider>
      <UserExpressionsPage />
    </QueryProvider>
  );
}
