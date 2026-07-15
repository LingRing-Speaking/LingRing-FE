import {
  isCancelledError,
  MutationCache,
  QueryCache,
  QueryClient,
} from "@tanstack/react-query";
import { ApiError } from "@/lib/http";
import { captureException } from "@/lib/sentry";

const SKIP_RETRY_STATUSES = [401, 403, 404];

function shouldRetry(failureCount: number, error: Error): boolean {
  if (error instanceof ApiError && SKIP_RETRY_STATUSES.includes(error.status)) {
    return false;
  }
  return failureCount < 3;
}

// 정상 흐름에서도 발생하는 실패는 보고하지 않는다:
// 네트워크 단절(status 0)·세션 만료(401)·요청 취소.
const EXPECTED_ERROR_STATUSES = [0, 401];

function shouldReportToSentry(error: Error): boolean {
  if (isCancelledError(error)) return false;
  if (error instanceof ApiError && EXPECTED_ERROR_STATUSES.includes(error.status)) {
    return false;
  }
  return true;
}

// 컴포넌트가 직접 처리하지 않는 쿼리/뮤테이션 에러의 전역 안전망.
// catch 된 에러는 Sentry 자동 수집에 걸리지 않으므로 여기서 명시적으로 보고한다.
export function createQueryClient(): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        if (!shouldReportToSentry(error)) return;
        captureException(error, {
          tags: { source: "query" },
          extra: { queryKey: query.queryKey },
        });
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        if (!shouldReportToSentry(error)) return;
        captureException(error, {
          tags: { source: "mutation" },
          extra: { mutationKey: mutation.options.mutationKey },
        });
      },
    }),
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
  });
}
