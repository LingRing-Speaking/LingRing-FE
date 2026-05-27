import { useNavigate, useParams } from "react-router-dom";
import { PageShell } from "@/components/PageShell";
import { usePollAnalysisStatus } from "@/domains/callHistory/hooks/usePollAnalysisStatus";
import { useAnalysisResult } from "@/domains/callHistory/hooks/useAnalysisResult";
import type { AnalysisResult } from "@/domains/callHistory/types";

export function AnalysisResultPage() {
  const { analysisId: rawId } = useParams<{ analysisId: string }>();
  const navigate = useNavigate();

  const analysisId = Number(rawId);
  const isValidId = Number.isInteger(analysisId) && analysisId > 0;

  const pollingQuery = usePollAnalysisStatus(isValidId ? analysisId : 0);
  const status = pollingQuery.data?.status;
  const resultQuery = useAnalysisResult(analysisId, status === "COMPLETED");

  const body = (() => {
    if (!isValidId) return <FallbackMessage text="잘못된 접근이에요." />;
    if (pollingQuery.isError)
      return <FallbackMessage text="상태를 불러오지 못했어요." />;
    if (pollingQuery.isPending || status === "PROCESSING")
      return <ProcessingView />;
    if (status === "FAILED") return <FailedView />;
    if (status === "COMPLETED") {
      if (resultQuery.isPending) return <ProcessingView />;
      if (resultQuery.isError || !resultQuery.data)
        return <FallbackMessage text="결과를 불러오지 못했어요." />;
      return <CompletedView result={resultQuery.data} />;
    }
    return null;
  })();

  return (
    <PageShell>
      <main className="relative flex flex-1 flex-col overflow-hidden bg-gray-50">
        <div className="relative flex h-[52px] items-center bg-white px-2">
          <button
            type="button"
            aria-label="뒤로가기"
            onClick={() => navigate(-1)}
            className="flex h-10 w-10 items-center justify-center rounded-full text-gray-900 transition-colors active:bg-gray-100"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <h1 className="absolute left-1/2 -translate-x-1/2 text-[17px] font-bold tracking-tight text-gray-900">
            분석 결과
          </h1>
        </div>

        <div className="flex-1 overflow-y-auto">{body}</div>
      </main>
    </PageShell>
  );
}

function ProcessingView() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-8">
      <div
        role="status"
        aria-label="분석 진행 중"
        className="h-10 w-10 animate-spin rounded-full border-[3px] border-gray-200 border-t-mint-500"
      />
      <p className="text-center text-[14.5px] font-medium leading-snug tracking-tight text-gray-600">
        AI 가 통화 내용을 분석 중이에요.
        <br />
        잠시만 기다려주세요.
      </p>
    </div>
  );
}

function FailedView() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-8">
      <p className="text-center text-[15px] font-semibold leading-snug tracking-tight text-gray-800">
        분석에 실패했어요.
      </p>
      <p className="text-center text-[13.5px] font-medium leading-relaxed tracking-tight text-gray-500">
        통화 기록으로 돌아가 다시 시도해주세요.
      </p>
    </div>
  );
}

function FallbackMessage({ text }: { text: string }) {
  return (
    <div className="flex h-full items-center justify-center px-8">
      <p className="text-center text-[14.5px] font-medium tracking-tight text-gray-600">
        {text}
      </p>
    </div>
  );
}

function CompletedView({ result }: { result: AnalysisResult }) {
  const { positives, mistakes } = result;
  const hasNothing = positives.length === 0 && mistakes.length === 0;

  if (hasNothing) {
    return (
      <div className="flex h-full items-center justify-center px-8">
        <p className="text-center text-[14.5px] font-medium leading-relaxed tracking-tight text-gray-600">
          이번 대화에서는 별다른 피드백이 없었어요.
          <br />
          다음 통화도 자연스럽게 이어가보세요.
        </p>
      </div>
    );
  }

  return (
    <div className="px-5 pb-8 pt-5">
      {positives.length > 0 && (
        <PositivesSection items={positives} />
      )}
      {mistakes.length > 0 && (
        <div className={positives.length > 0 ? "mt-7" : ""}>
          <MistakesSection items={mistakes} />
        </div>
      )}
    </div>
  );
}

function PositivesSection({
  items,
}: {
  items: AnalysisResult["positives"];
}) {
  return (
    <section>
      <SectionTitle title="이번 대화에서 잘한 점" count={items.length} />
      <ul className="flex flex-col gap-2.5" role="list">
        {items.map((item, idx) => (
          <li
            key={idx}
            className="rounded-[18px] border-l-[3px] border-mint-400 bg-white px-4 py-3.5 shadow-card"
          >
            <p className="m-0 text-[15px] font-semibold leading-snug tracking-tight text-gray-900">
              <span className="text-mint-500">&ldquo;</span>
              {item.sentence}
              <span className="text-mint-500">&rdquo;</span>
            </p>
            <p className="mt-1 text-[13px] font-medium leading-snug tracking-tight text-gray-600">
              {item.koMeaning}
            </p>
            <p className="mt-2 text-[13px] font-medium leading-snug tracking-tight text-gray-500">
              특히 <span className="text-gray-700">{item.goodPart}</span> 부분이
              좋았어요.
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function MistakesSection({
  items,
}: {
  items: AnalysisResult["mistakes"];
}) {
  return (
    <section>
      <SectionTitle title="이렇게 말해보세요" count={items.length} />
      <ul className="flex flex-col gap-2.5" role="list">
        {items.map((item, idx) => (
          <li
            key={idx}
            className="relative rounded-[18px] bg-white px-4 py-3.5 shadow-card"
          >
            <div className="flex items-start gap-2">
              <span className="mt-[2px] flex-shrink-0 rounded-md bg-gray-100 px-2 py-[2px] text-[10.5px] font-bold tracking-tight text-gray-600">
                원래
              </span>
              <p className="m-0 text-[14.5px] font-semibold leading-snug tracking-tight text-gray-500 line-through">
                {item.wrong}
              </p>
            </div>
            <div className="mt-1.5 flex items-start gap-2">
              <span className="mt-[2px] flex-shrink-0 rounded-md bg-mint-100 px-2 py-[2px] text-[10.5px] font-bold tracking-tight text-mint-600">
                자연스럽게
              </span>
              <p className="m-0 text-[14.5px] font-semibold leading-snug tracking-tight text-gray-900">
                {item.improved}
              </p>
            </div>
            <p className="mt-1.5 text-[12.5px] font-medium leading-snug tracking-tight text-gray-500">
              {item.koMeaning}
            </p>
            <div className="mt-3 flex gap-1.5 rounded-[10px] bg-mint-50 px-3 py-2.5">
              <span aria-hidden="true">💡</span>
              <span className="text-[12.5px] font-medium leading-snug tracking-tight text-gray-700">
                {item.reason}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SectionTitle({ title, count }: { title: string; count: number }) {
  return (
    <h2 className="mx-1 mb-3 flex items-center gap-2 text-[16px] font-bold tracking-tight text-gray-900">
      {title}
      <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-gray-100 px-1.5 text-[11.5px] font-bold tabular-nums text-gray-600">
        {count}
      </span>
    </h2>
  );
}
