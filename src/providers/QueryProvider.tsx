import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { ApiError } from "@/lib/http";

const SKIP_RETRY_STATUSES = [401, 403, 404];

function shouldRetry(failureCount: number, error: Error): boolean {
  if (error instanceof ApiError && SKIP_RETRY_STATUSES.includes(error.status)) {
    return false;
  }
  return failureCount < 3;
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: shouldRetry,
          },
          mutations: {
            retry: shouldRetry,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
