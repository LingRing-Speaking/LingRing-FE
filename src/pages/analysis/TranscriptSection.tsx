import type { UseQueryResult } from "@tanstack/react-query";
import { useState } from "react";
import { useUserId } from "@/domains/auth/hooks/useUserId";
import { useCallTranscript } from "@/domains/callHistory/hooks/useCallTranscript";
import type { CallTranscript, TranscriptSegment } from "@/domains/callHistory/types";
import type { ApiError } from "@/lib/http";

/**
 * 통화 시작 기준 초(소수)를 "분 초" 로 — 시각(시:분)과 헷갈리지 않도록 콜론 대신
 * 한글 단위를 붙인다. 1분 미만은 초만 표기한다(예: 65.2 → "1분 5초", 2.4 → "2초").
 */
function formatTime(sec: number): string {
  const total = Math.floor(sec);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return minutes > 0 ? `${minutes}분 ${seconds}초` : `${seconds}초`;
}

/**
 * 분석 결과 화면 하단의 "전체 대화 보기" 섹션. 토글을 펼친 동안에만 통화 스크립트를
 * lazy 하게 조회한다(첫 펼침에만 fetch, 이후 캐시). 화자는 본인의 인증된 userId 와
 * 세그먼트 userId 를 비교해 나/상대로 가른다.
 */
export function TranscriptSection({ callId }: { callId: number }) {
  const [open, setOpen] = useState(false);
  const myUserId = useUserId();
  const query = useCallTranscript(callId, open);

  return (
    <section className="mt-7">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="flex w-full items-center justify-between rounded-[18px] bg-white px-4 py-3.5 shadow-card transition-colors active:bg-gray-50"
      >
        <span className="text-[14.5px] font-bold tracking-tight text-gray-800">전체 대화 보기</span>
        <svg
          viewBox="0 0 24 24"
          className={`h-[18px] w-[18px] text-gray-500 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="mt-3">
          <TranscriptBody query={query} myUserId={myUserId} />
        </div>
      )}
    </section>
  );
}

function TranscriptBody({
  query,
  myUserId,
}: {
  query: UseQueryResult<CallTranscript, ApiError>;
  myUserId: number;
}) {
  if (query.isPending) {
    return (
      <div className="flex justify-center py-6">
        <div
          role="status"
          aria-label="대화 불러오는 중"
          className="h-7 w-7 animate-spin rounded-full border-[3px] border-gray-200 border-t-mint-500"
        />
      </div>
    );
  }

  if (query.isError) {
    return <BodyMessage text="대화를 불러오지 못했어요." />;
  }

  const segments = query.data.segments;
  if (segments.length === 0) {
    return <BodyMessage text="아직 대화 내용이 없어요." />;
  }

  return (
    <ul className="flex flex-col gap-2.5 px-2" role="list">
      {segments.map((segment, index) => (
        <TranscriptBubble key={index} segment={segment} mine={segment.userId === myUserId} />
      ))}
    </ul>
  );
}

function TranscriptBubble({ segment, mine }: { segment: TranscriptSegment; mine: boolean }) {
  const time = (
    <span className="whitespace-nowrap text-[10.5px] font-medium tabular-nums text-gray-400">
      {formatTime(segment.startSec)}
    </span>
  );

  return (
    <li
      data-speaker={mine ? "me" : "partner"}
      className={`flex items-end gap-2 ${mine ? "justify-end" : "justify-start"}`}
    >
      {mine && time}
      <p
        className={`m-0 max-w-[72%] rounded-2xl px-3 py-2.5 text-[13.5px] font-medium leading-snug tracking-tight ${
          mine
            ? "rounded-br-sm bg-mint-500 text-white"
            : "rounded-bl-sm border border-gray-100 bg-white text-gray-900"
        }`}
      >
        {segment.text}
      </p>
      {!mine && time}
    </li>
  );
}

function BodyMessage({ text }: { text: string }) {
  return (
    <p className="py-6 text-center text-[13.5px] font-medium tracking-tight text-gray-500">
      {text}
    </p>
  );
}
