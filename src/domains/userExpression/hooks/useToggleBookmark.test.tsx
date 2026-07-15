import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { delay, http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { server } from "@/mocks/server";
import { useToggleBookmark } from "./useToggleBookmark";

const API = "http://localhost:3000/api/v1";
const KEY = ["test-cache"];

type Cache = { items: Array<{ id: number; bookmarkId: number | null }> };

// id === 1 항목의 bookmarkId 만 교체하는 어댑터 patch.
const patch =
  (itemId: number) =>
  (data: Cache, nextBookmarkId: number | null): Cache => ({
    items: data.items.map((it) =>
      it.id === itemId ? { ...it, bookmarkId: nextBookmarkId } : it,
    ),
  });

function setup(seed: Cache) {
  // gcTime: Infinity — 옵저버 없이 seed 한 테스트 캐시가 GC 되지 않도록.
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
  qc.setQueryData(KEY, seed);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(
    () => useToggleBookmark<Cache>({ queryKey: KEY, patch: patch(1) }),
    { wrapper },
  );
  const bookmarkId = () => qc.getQueryData<Cache>(KEY)!.items[0].bookmarkId;
  return { qc, result, bookmarkId };
}

describe("useToggleBookmark", () => {
  it("미찜 항목을 토글하면 낙관적으로 찜 표시 후 생성된 실제 id 를 반영한다", async () => {
    server.use(
      http.post(`${API}/expressions`, async () => {
        await delay(30);
        return HttpResponse.json({
          data: { id: 77, userId: 1, expression: "x", meaning: "y", createdAt: "" },
          status: 201,
          message: "CREATED",
        });
      }),
    );
    const { result, bookmarkId } = setup({ items: [{ id: 1, bookmarkId: null }] });

    act(() => {
      result.current.toggle(null, { source: "ICEBREAKER", icebreakerId: 1 });
    });

    // 응답 전: 낙관적으로 즉시 찜 표시(비-null)
    await waitFor(() => expect(bookmarkId()).not.toBeNull());
    // 응답 후: 실제 id 로 확정
    await waitFor(() => expect(bookmarkId()).toBe(77));
  });

  it("찜된 항목을 토글하면 DELETE /expressions/{bookmarkId} 를 쏘고 낙관적으로 해제한다", async () => {
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
    const { result, bookmarkId } = setup({ items: [{ id: 1, bookmarkId: 55 }] });

    act(() => {
      result.current.toggle(55, { source: "ICEBREAKER", icebreakerId: 1 });
    });

    await waitFor(() => expect(bookmarkId()).toBeNull());
    await waitFor(() => expect(deletedId).toBe("55"));
  });

  it("생성 실패 시 이전 상태로 롤백한다", async () => {
    // 응답을 게이트로 잡아 낙관적 상태를 확인한 뒤 풀어준다(타이밍 레이스 제거).
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.post(`${API}/expressions`, async () => {
        await gate;
        return HttpResponse.json(
          { data: null, status: 400, message: "FAIL" },
          { status: 400 },
        );
      }),
    );
    const { result, bookmarkId } = setup({ items: [{ id: 1, bookmarkId: null }] });

    act(() => {
      result.current.toggle(null, { source: "ICEBREAKER", icebreakerId: 1 });
    });

    // 응답 전: 낙관적으로 찜 표시
    await waitFor(() => expect(bookmarkId()).not.toBeNull());
    // 응답(실패) 풀어주면 이전 상태로 롤백
    release();
    await waitFor(() => expect(bookmarkId()).toBeNull());
  });

  it("정착 후 관련 쿼리들을 무효화한다(교차 화면 동기화)", async () => {
    server.use(
      http.post(`${API}/expressions`, () =>
        HttpResponse.json({
          data: { id: 77, userId: 1, expression: "x", meaning: "y", createdAt: "" },
          status: 201,
          message: "CREATED",
        }),
      ),
    );
    const { qc, result, bookmarkId } = setup({
      items: [{ id: 1, bookmarkId: null }],
    });
    const spy = vi.spyOn(qc, "invalidateQueries");

    act(() => {
      result.current.toggle(null, { source: "ICEBREAKER", icebreakerId: 1 });
    });
    await waitFor(() => expect(bookmarkId()).toBe(77));

    const invalidated = spy.mock.calls.map((c) => c[0]?.queryKey);
    expect(invalidated).toEqual(
      expect.arrayContaining([["expressions"], ["me", "stats"]]),
    );
    // 아이스브레이커 랜덤 쿼리는 무효화하지 않는다 — 무효화하면 문장이 재추첨된다.
    expect(invalidated).not.toContainEqual(["icebreakers"]);
  });
});
