import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderOptions } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { useAuthStore } from "@/domains/auth/store";
import type { User } from "@/domains/auth/types";

const DEFAULT_TEST_USER: User = { id: 1, nickname: "tester" };

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

type Options = Omit<RenderOptions, "wrapper"> & {
  initialEntries?: string[];
  user?: User | null;
};

export function renderWithQueryClient(ui: ReactElement, options?: Options) {
  const user = options?.user === undefined ? DEFAULT_TEST_USER : options.user;
  useAuthStore.setState({
    user,
    accessToken: user ? "test-access" : null,
    refreshToken: user ? "test-refresh" : null,
    isAuthenticated: user !== null,
  });

  const queryClient = createTestQueryClient();
  const initialEntries = options?.initialEntries ?? ["/"];
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
    </QueryClientProvider>
  );
  return { queryClient, ...render(ui, { wrapper: Wrapper, ...options }) };
}
