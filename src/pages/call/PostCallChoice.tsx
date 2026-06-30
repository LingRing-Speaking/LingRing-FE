import type { EndReason } from "@/domains/call/hooks/useCallSession";

type Headline = { title: string; sub: string };

function headlineFor(reason: EndReason): Headline {
  switch (reason) {
    case "timeout":
      return { title: "통화가 끝났어요", sub: "20분 통화, 수고했어요! 이제 무엇을 할까요?" };
    case "peer":
    case "dropped":
      return { title: "상대방이 통화를 종료했어요", sub: "이제 무엇을 할까요?" };
    case "self":
      return { title: "통화가 끝났어요", sub: "오늘 대화는 어땠나요? 이제 무엇을 할까요?" };
  }
}

/**
 * 통화 종료 후 다음 행동을 고르는 화면. 종료 이유(reason)에 따라 헤드라인만
 * 달라지고, 두 선택지(분석하기 / 한 번 더 대화하기)는 우열 없이 동등하다.
 */
export function PostCallChoice({
  reason,
  onAnalyze,
  onTalkAgain,
}: {
  reason: EndReason;
  onAnalyze: () => void;
  onTalkAgain: () => void;
}) {
  const { title, sub } = headlineFor(reason);

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-1.5 bg-[radial-gradient(ellipse_at_50%_40%,theme(colors.mint.50)_0%,white_60%)] px-8 text-center">
      <div className="mb-4 flex h-[72px] w-[72px] items-center justify-center rounded-full bg-mint-500 text-white shadow-[0_12px_28px_rgba(31,191,146,0.35)]">
        <svg
          viewBox="0 0 24 24"
          className="h-[38px] w-[38px]"
          fill="none"
          stroke="currentColor"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </div>
      <h2 className="m-0 text-[22px] font-bold leading-snug tracking-[-0.02em] text-gray-900">
        {title}
      </h2>
      <p className="m-0 mt-1 text-[14px] font-medium leading-relaxed text-gray-600">
        {sub}
      </p>

      <div className="mt-6 flex w-full max-w-[300px] flex-col gap-2.5">
        <ChoiceCard
          label="통화 내용 분석하기"
          desc="발음·표현 피드백 리포트 받기"
          onClick={onAnalyze}
          icon={
            <>
              <path d="M3 3v18h18" />
              <path d="M8 17v-5" />
              <path d="M13 17V8" />
              <path d="M18 17v-9" />
            </>
          }
        />
        <ChoiceCard
          label="한 번 더 대화하기"
          desc="새로운 상대와 바로 연결"
          onClick={onTalkAgain}
          icon={
            <>
              <path d="M17 2l4 4-4 4" />
              <path d="M3 11V9a4 4 0 0 1 4-4h14" />
              <path d="M7 22l-4-4 4-4" />
              <path d="M21 13v2a4 4 0 0 1-4 4H3" />
            </>
          }
        />
      </div>
    </div>
  );
}

function ChoiceCard({
  label,
  desc,
  onClick,
  icon,
}: {
  label: string;
  desc: string;
  onClick: () => void;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex w-full items-center gap-3.5 rounded-2xl bg-white p-4 text-left shadow-card transition active:scale-[0.98]"
    >
      <span className="flex h-[42px] w-[42px] flex-none items-center justify-center rounded-xl bg-mint-50 text-mint-600">
        <svg
          viewBox="0 0 24 24"
          className="h-[22px] w-[22px]"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {icon}
        </svg>
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="text-[15px] font-bold leading-tight tracking-[-0.01em] text-gray-900">
          {label}
        </span>
        <span className="text-[12px] font-medium leading-tight text-gray-500">
          {desc}
        </span>
      </span>
    </button>
  );
}
