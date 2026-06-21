import { PageShell } from "@/components/PageShell";

interface ConnectionErrorViewProps {
  onRetry: () => void;
  retrying: boolean;
}

export function ConnectionErrorView({ onRetry, retrying }: ConnectionErrorViewProps) {
  return (
    <PageShell>
      <main className="flex flex-1 flex-col items-center justify-center bg-white px-6">
        <section className="flex flex-col items-center gap-3 text-center">
          <h1 className="text-[22px] font-bold tracking-[-0.02em] text-gray-900">
            연결이 불안정해요
          </h1>
          <p className="max-w-[280px] text-[14px] font-medium leading-snug tracking-[-0.01em] text-gray-600">
            네트워크 상태를 확인한 뒤 다시 시도해 주세요.
            <br />
            로그인은 그대로 유지돼요.
          </p>
        </section>

        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className="mt-9 flex h-14 w-full max-w-[320px] items-center justify-center rounded-[14px] bg-gray-900 text-[15.5px] font-semibold text-white shadow-[0_6px_18px_rgba(0,0,0,0.06)] transition active:scale-[0.98] active:brightness-95 disabled:opacity-60"
        >
          {retrying ? "다시 시도 중…" : "다시 시도"}
        </button>
      </main>
    </PageShell>
  );
}
