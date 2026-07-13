import {
  useMutation,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { deleteExpression } from "../api/bookmarkApi";
import type { UserExpressionList } from "../types";
import { invalidateBookmarkQueries } from "./bookmarkInvalidation";

type ExpressionsCache = InfiniteData<UserExpressionList, number>;

const removeFromCache = (
  data: ExpressionsCache,
  id: number,
): ExpressionsCache => ({
  ...data,
  pages: data.pages.map((page) => ({
    ...page,
    items: page.items.filter((item) => item.id !== id),
  })),
});

/**
 * "저장한 표현" 목록에서 표현을 삭제(찜 해제)한다. 무한쿼리 캐시에서 낙관적으로
 * 제거하고 실패 시 원복한다. 정착 후 소스 카드 별표 상태까지 무효화로 동기화한다.
 */
export function useDeleteExpression() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (id: number) => deleteExpression(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["expressions"] });
      const snapshot = queryClient.getQueryData<ExpressionsCache>([
        "expressions",
      ]);
      if (snapshot !== undefined) {
        queryClient.setQueryData<ExpressionsCache>(
          ["expressions"],
          removeFromCache(snapshot, id),
        );
      }
      return { snapshot };
    },
    onError: (_error, _id, context) => {
      if (context?.snapshot !== undefined) {
        queryClient.setQueryData<ExpressionsCache>(
          ["expressions"],
          context.snapshot,
        );
      }
    },
    onSettled: () => {
      invalidateBookmarkQueries(queryClient);
    },
  });

  return {
    remove: (id: number) => mutation.mutate(id),
    isPending: mutation.isPending,
  };
}
