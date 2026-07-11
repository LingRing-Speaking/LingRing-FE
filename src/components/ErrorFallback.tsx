interface ErrorFallbackProps {
  resetError: () => void;
}

// Sentry ErrorBoundary 의 fallback — React 렌더 크래시 시 흰 화면 대신 노출된다.
// 에러 리포트는 ErrorBoundary 가 이미 보냈으므로 여기서는 복구 UI만 담당한다.
export function ErrorFallback({ resetError }: ErrorFallbackProps) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-white px-8">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-coral-100 text-3xl">
        ⚠️
      </div>
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-title-l text-gray-900">문제가 발생했어요</h1>
        <p className="text-center text-body-s text-gray-500">
          일시적인 오류일 수 있어요.
          <br />
          잠시 후 다시 시도해주세요.
        </p>
      </div>
      <button
        type="button"
        onClick={resetError}
        className="rounded-md bg-mint-500 px-8 py-3 text-body-m text-white shadow-button active:bg-mint-600"
      >
        다시 시도
      </button>
    </div>
  );
}
