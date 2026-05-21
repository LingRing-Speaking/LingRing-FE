import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { CallHistoryItem } from "@/domains/callHistory/types";
import { CallCard } from "./CallCard";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function renderCard(
  item: CallHistoryItem,
  onPartnerClick: (id: number) => void = () => {},
) {
  const queryClient = makeQueryClient();
  // ['calls'] 캐시를 seed 해두면 optimistic update 의 효과(IN_PROGRESS 전환) 를 검증할 수 있다.
  queryClient.setQueryData(["calls"], {
    pages: [{ items: [item], hasNext: false }],
    pageParams: [0],
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return {
    queryClient,
    ...render(
      <CallCard
        call={item}
        now={new Date(2026, 3, 29, 14, 0)}
        onPartnerClick={onPartnerClick}
      />,
      { wrapper },
    ),
  };
}

const baseCall: CallHistoryItem = {
  id: 42,
  partner: { id: 1042, name: "Jenson", profileImage: null },
  startedAt: new Date(2026, 3, 29, 19, 30, 0).toISOString(),
  durationSec: 323,
  analysisStatus: "NONE",
};

describe("CallCard", () => {
  it("partner 이름 첫 글자(이니셜)와 이름·메타 텍스트를 노출한다", () => {
    renderCard(baseCall);
    expect(screen.getByText("J")).toBeInTheDocument();
    expect(screen.getByText("Jenson")).toBeInTheDocument();
    expect(screen.getByText(/오늘 오후 7:30/)).toBeInTheDocument();
  });

  it("partner.profileImage 가 있으면 이니셜 대신 이미지가 노출된다", () => {
    renderCard({
      ...baseCall,
      partner: { id: 1042, name: "Jenson", profileImage: "https://cdn/x.png" },
    });
    expect(screen.getByAltText("상대 프로필 이미지")).toHaveAttribute(
      "src",
      "https://cdn/x.png",
    );
    expect(screen.queryByText("J")).not.toBeInTheDocument();
  });

  it("body(아바타·이름 영역) 클릭 시 onPartnerClick 이 호출된다", async () => {
    const onPartnerClick = vi.fn();
    renderCard(baseCall, onPartnerClick);
    await userEvent.click(screen.getByText("Jenson"));
    expect(onPartnerClick).toHaveBeenCalledWith(1042);
  });

  describe("분석 버튼 (analysisStatus)", () => {
    it("NONE 이면 '분석하기' 버튼이 노출된다", () => {
      renderCard({ ...baseCall, analysisStatus: "NONE" });
      expect(
        screen.getByRole("button", { name: "분석하기" }),
      ).toBeInTheDocument();
    });

    it("IN_PROGRESS 면 '분석중' 버튼 + 스피너가 노출된다", () => {
      renderCard({ ...baseCall, analysisStatus: "IN_PROGRESS" });
      expect(screen.getByRole("button", { name: "분석중" })).toBeDisabled();
      expect(
        screen.getByRole("status", { name: "분석 진행 중" }),
      ).toBeInTheDocument();
    });

    it("COMPLETED 면 '분석 보기' 버튼이 노출된다", () => {
      renderCard({ ...baseCall, analysisStatus: "COMPLETED" });
      expect(
        screen.getByRole("button", { name: "분석 보기" }),
      ).toBeInTheDocument();
    });

    it("'분석하기' 클릭 시 ['calls'] 캐시가 즉시 IN_PROGRESS 로 바뀐다 (optimistic)", async () => {
      const { queryClient } = renderCard({ ...baseCall, analysisStatus: "NONE" });
      await userEvent.click(screen.getByRole("button", { name: "분석하기" }));

      await waitFor(() => {
        const cache = queryClient.getQueryData<{
          pages: { items: CallHistoryItem[] }[];
        }>(["calls"]);
        expect(cache?.pages[0]?.items[0]?.analysisStatus).toBe("IN_PROGRESS");
      });
    });
  });

  describe("partner=null (상대가 탈퇴한 통화)", () => {
    const unknownCall: CallHistoryItem = { ...baseCall, partner: null };

    it("'알 수 없음' 텍스트와 ? 플레이스홀더 아바타를 노출한다", () => {
      renderCard(unknownCall);
      expect(screen.getByText("알 수 없음")).toBeInTheDocument();
      expect(screen.getByText("?")).toBeInTheDocument();
      // Avatar 컴포넌트의 alt 가 없어야 함 (Avatar 자체가 렌더되지 않음)
      expect(screen.queryByAltText("상대 프로필 이미지")).not.toBeInTheDocument();
    });

    it("body 버튼이 disabled 라 클릭해도 onPartnerClick 이 호출되지 않는다", async () => {
      const onPartnerClick = vi.fn();
      renderCard(unknownCall, onPartnerClick);
      const bodyBtn = screen.getByRole("button", { name: /알 수 없음/ });
      expect(bodyBtn).toBeDisabled();
      await userEvent.click(bodyBtn);
      expect(onPartnerClick).not.toHaveBeenCalled();
    });

    it("메타 텍스트(시각·길이)는 partner 유무와 무관하게 그대로 표시된다", () => {
      renderCard(unknownCall);
      expect(screen.getByText(/오늘 오후 7:30/)).toBeInTheDocument();
    });
  });
});
