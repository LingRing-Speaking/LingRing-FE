import {
  QueryClient,
  QueryClientProvider,
  type InfiniteData,
} from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { server } from "@/mocks/server";
import type { UserExpressionList } from "../types";
import { useDeleteExpression } from "./useDeleteExpression";

const API = "http://localhost:3000/api/v1";

type Data = InfiniteData<UserExpressionList, number>;

const seedData = (): Data => ({
  pages: [
    {
      items: [
        { id: 1, userId: 1, expression: "a", meaning: "가", createdAt: "" },
        { id: 2, userId: 1, expression: "b", meaning: "나", createdAt: "" },
      ],
      hasNext: false,
    },
  ],
  pageParams: [0],
});

function setup() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
  qc.setQueryData(["expressions"], seedData());
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useDeleteExpression(), { wrapper });
  const ids = () =>
    qc
      .getQueryData<Data>(["expressions"])
      ?.pages.flatMap((p) => p.items)
      .map((it) => it.id) ?? [];
  return { result, ids };
}

describe("useDeleteExpression", () => {
  it("삭제하면 목록에서 낙관적으로 제거하고 DELETE 를 호출한다", async () => {
    let deletedId: string | null = null;
    server.use(
      http.delete(`${API}/expressions/:id`, ({ params }) => {
        deletedId = String(params.id);
        return HttpResponse.json({
          data: null,
          status: 204,
          message: "NO_CONTENT",
        });
      }),
    );
    const { result, ids } = setup();

    act(() => {
      result.current.remove(1);
    });

    await waitFor(() => expect(ids()).toEqual([2]));
    await waitFor(() => expect(deletedId).toBe("1"));
  });

  it("삭제 실패 시 목록을 원복한다", async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.delete(`${API}/expressions/:id`, async () => {
        await gate;
        return HttpResponse.json(
          { data: null, status: 500, message: "FAIL" },
          { status: 500 },
        );
      }),
    );
    const { result, ids } = setup();

    act(() => {
      result.current.remove(1);
    });

    await waitFor(() => expect(ids()).toEqual([2]));
    release();
    await waitFor(() => expect(ids()).toEqual([1, 2]));
  });
});
