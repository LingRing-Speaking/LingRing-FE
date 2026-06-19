import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { server } from "@/mocks/server";
import { createTestQueryClient } from "../../../../test/utils/renderWithQueryClient";
import { useDeclineMatch } from "./useDeclineMatch";

const wrapper = ({ children }: { children: ReactNode }) => {
  const queryClient = createTestQueryClient();
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useDeclineMatch", () => {
  it("mutate 호출 시 decline 엔드포인트가 호출된다", async () => {
    let postCount = 0;
    server.use(
      http.post("http://localhost:3000/api/v1/me/matching/decline", () => {
        postCount++;
        return HttpResponse.json({
          data: null,
          status: 204,
          message: "NO_CONTENT",
        });
      }),
    );

    const { result } = renderHook(() => useDeclineMatch(), { wrapper });

    result.current.mutate();

    await waitFor(() => expect(postCount).toBe(1));
  });
});
