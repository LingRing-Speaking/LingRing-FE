import {
  useMutation,
  useQueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { createBookmark, deleteExpression } from "../api/bookmarkApi";
import type { BookmarkSource } from "../types";
import { invalidateBookmarkQueries } from "./bookmarkInvalidation";

// 응답이 오기 전 낙관적으로 "찜됨"을 표시하기 위한 임시 bookmarkId.
// onSuccess 에서 실제 id 로 교체된다.
const OPTIMISTIC_BOOKMARK_ID = Number.MAX_SAFE_INTEGER;

type ToggleVars =
  | { kind: "create"; body: BookmarkSource }
  | { kind: "delete"; bookmarkId: number };

type Options<TData> = {
  /** 낙관적 패치·롤백 대상 캐시 키. */
  queryKey: QueryKey;
  /** 해당 캐시에서 대상 아이템의 bookmarkId 를 교체해 새 데이터를 만드는 어댑터. */
  patch: (data: TData, nextBookmarkId: number | null) => TData;
};

/**
 * 문장(표현) 찜 토글 훅. 세 소스(분석 mistake·오늘의 추천·아이스브레이커)가 공유한다.
 * mutation·롤백·무효화 로직은 동일하고, 캐시 형태 차이만 호출부 `patch` 어댑터가 흡수한다.
 */
export function useToggleBookmark<TData>({ queryKey, patch }: Options<TData>) {
  const queryClient = useQueryClient();

  const applyPatch = (nextBookmarkId: number | null) => {
    const current = queryClient.getQueryData<TData>(queryKey);
    if (current === undefined) return;
    queryClient.setQueryData<TData>(queryKey, patch(current, nextBookmarkId));
  };

  const mutation = useMutation({
    mutationFn: async (vars: ToggleVars) => {
      if (vars.kind === "create") return createBookmark(vars.body);
      await deleteExpression(vars.bookmarkId);
      return null;
    },
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey });
      const snapshot = queryClient.getQueryData<TData>(queryKey);
      applyPatch(vars.kind === "create" ? OPTIMISTIC_BOOKMARK_ID : null);
      return { snapshot };
    },
    onError: (_error, _vars, context) => {
      if (context?.snapshot !== undefined) {
        queryClient.setQueryData<TData>(queryKey, context.snapshot);
      }
    },
    onSuccess: (result, vars) => {
      if (vars.kind === "create" && result) applyPatch(result.id);
    },
    onSettled: () => {
      invalidateBookmarkQueries(queryClient);
    },
  });

  const toggle = (
    currentBookmarkId: number | null,
    createBody: BookmarkSource,
  ) => {
    if (mutation.isPending) return;
    if (currentBookmarkId === null) {
      mutation.mutate({ kind: "create", body: createBody });
    } else {
      mutation.mutate({ kind: "delete", bookmarkId: currentBookmarkId });
    }
  };

  return { toggle, isPending: mutation.isPending };
}
