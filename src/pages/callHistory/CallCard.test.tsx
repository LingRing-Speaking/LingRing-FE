import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { CallHistoryItem } from "@/domains/callHistory/types";
import { CallCard } from "./CallCard";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location-pathname">{location.pathname}</div>;
}

function renderCard(
  item: CallHistoryItem,
  onPartnerClick: (id: number) => void = () => {},
  onAnalyze: (callId: number) => void = () => {},
) {
  const queryClient = makeQueryClient();
  queryClient.setQueryData(["calls"], {
    pages: [{ items: [item], hasNext: false }],
    pageParams: [0],
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/history"]}>
        <Routes>
          <Route path="/history" element={children} />
          <Route path="/analyses/:analysisId" element={<LocationDisplay />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
  return {
    queryClient,
    ...render(
      <CallCard
        call={item}
        now={new Date(2026, 3, 29, 14, 0)}
        onPartnerClick={onPartnerClick}
        onAnalyze={onAnalyze}
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
  analysisId: null,
  analysisStatus: "READY",
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
    it("WAITING_RECORDINGS 면 '대기중' 버튼(비활성)이 노출된다", () => {
      renderCard({
        ...baseCall,
        analysisStatus: "WAITING_RECORDINGS",
        analysisId: null,
      });
      expect(screen.getByRole("button", { name: "대기중" })).toBeDisabled();
    });

    it("READY 면 '분석하기' 버튼이 노출된다", () => {
      renderCard({ ...baseCall, analysisStatus: "READY", analysisId: null });
      expect(
        screen.getByRole("button", { name: "분석하기" }),
      ).toBeInTheDocument();
    });

    it("PROCESSING 이면 '분석중' 버튼(비활성)이 노출된다", () => {
      renderCard({
        ...baseCall,
        analysisStatus: "PROCESSING",
        analysisId: 100,
      });
      expect(screen.getByRole("button", { name: "분석중" })).toBeDisabled();
    });

    it("COMPLETED 면 '분석보기' 버튼이 노출된다", () => {
      renderCard({
        ...baseCall,
        analysisStatus: "COMPLETED",
        analysisId: 100,
      });
      expect(
        screen.getByRole("button", { name: "분석보기" }),
      ).toBeInTheDocument();
    });

    it("FAILED 면 '재분석' 버튼이 노출된다", () => {
      renderCard({ ...baseCall, analysisStatus: "FAILED", analysisId: 100 });
      expect(
        screen.getByRole("button", { name: "재분석" }),
      ).toBeInTheDocument();
    });

    it("'분석하기' 클릭 시 onAnalyze(call.id) 를 호출한다 (카드는 직접 요청하지 않고 결과 페이지로도 이동하지 않는다)", async () => {
      const onAnalyze = vi.fn();
      renderCard(
        { ...baseCall, analysisStatus: "READY", analysisId: null },
        () => {},
        onAnalyze,
      );
      await userEvent.click(screen.getByRole("button", { name: "분석하기" }));

      expect(onAnalyze).toHaveBeenCalledWith(42);
      // 분석 흐름은 카드에 머무름 — 결과 페이지로 이동하지 않아야 한다.
      expect(screen.queryByTestId("location-pathname")).not.toBeInTheDocument();
    });

    it("'분석보기' 클릭 시 /analyses/{analysisId} 로 이동한다", async () => {
      renderCard({
        ...baseCall,
        analysisStatus: "COMPLETED",
        analysisId: 100,
      });
      await userEvent.click(screen.getByRole("button", { name: "분석보기" }));
      await waitFor(() => {
        expect(screen.getByTestId("location-pathname")).toHaveTextContent(
          "/analyses/100",
        );
      });
    });

    it("analysisId 가 없는 COMPLETED(이론상 모순) 면 '분석보기' 를 눌러도 이동하지 않는다", async () => {
      renderCard({
        ...baseCall,
        analysisStatus: "COMPLETED",
        analysisId: null,
      });
      await userEvent.click(screen.getByRole("button", { name: "분석보기" }));
      expect(screen.queryByTestId("location-pathname")).not.toBeInTheDocument();
    });

    it("'재분석' 클릭 시에도 onAnalyze(call.id) 를 호출한다", async () => {
      const onAnalyze = vi.fn();
      renderCard(
        { ...baseCall, analysisStatus: "FAILED", analysisId: 100 },
        () => {},
        onAnalyze,
      );
      await userEvent.click(screen.getByRole("button", { name: "재분석" }));

      expect(onAnalyze).toHaveBeenCalledWith(42);
    });
  });

  describe("1분 미만 통화 분석 제한", () => {
    it("durationSec < 60 이고 READY 면 '분석하기' 버튼을 노출하지 않는다", () => {
      renderCard({
        ...baseCall,
        durationSec: 42,
        analysisStatus: "READY",
        analysisId: null,
      });
      expect(screen.queryByRole("button", { name: "분석하기" })).not.toBeInTheDocument();
    });

    it("durationSec 가 정확히 60 이면 '분석하기' 버튼을 노출한다 (경계)", () => {
      renderCard({
        ...baseCall,
        durationSec: 60,
        analysisStatus: "READY",
        analysisId: null,
      });
      expect(screen.getByRole("button", { name: "분석하기" })).toBeInTheDocument();
    });

    it("durationSec < 60 이고 FAILED 여도 '재분석' 버튼을 노출하지 않는다", () => {
      renderCard({
        ...baseCall,
        durationSec: 42,
        analysisStatus: "FAILED",
        analysisId: 100,
      });
      expect(screen.queryByRole("button", { name: "재분석" })).not.toBeInTheDocument();
    });

    it("durationSec < 60 이고 WAITING_RECORDINGS 여도 '대기중' 버튼을 노출하지 않는다", () => {
      renderCard({
        ...baseCall,
        durationSec: 42,
        analysisStatus: "WAITING_RECORDINGS",
        analysisId: null,
      });
      expect(
        screen.queryByRole("button", { name: "대기중" }),
      ).not.toBeInTheDocument();
    });

    it("durationSec < 60 이라도 PROCESSING 이면 '분석중' 은 노출한다 (진행 중 보존)", () => {
      renderCard({
        ...baseCall,
        durationSec: 42,
        analysisStatus: "PROCESSING",
        analysisId: 100,
      });
      expect(screen.getByRole("button", { name: "분석중" })).toBeInTheDocument();
    });

    it("durationSec < 60 이라도 COMPLETED 면 '분석보기' 는 노출한다 (기존 결과 조회 보존)", () => {
      renderCard({
        ...baseCall,
        durationSec: 42,
        analysisStatus: "COMPLETED",
        analysisId: 100,
      });
      expect(screen.getByRole("button", { name: "분석보기" })).toBeInTheDocument();
    });
  });

  describe("partner=null (상대가 탈퇴한 통화)", () => {
    const unknownCall: CallHistoryItem = { ...baseCall, partner: null };

    it("'알 수 없음' 텍스트와 ? 플레이스홀더 아바타를 노출한다", () => {
      renderCard(unknownCall);
      expect(screen.getByText("알 수 없음")).toBeInTheDocument();
      expect(screen.getByText("?")).toBeInTheDocument();
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

  describe("녹음 만료 안내 (now=2026-04-29 14:00)", () => {
    // 종료 후 약 25일 지난 통화 → 만료까지 5~6일 남아 임박 구간.
    const nearExpiry = new Date(2026, 3, 4, 12, 0).toISOString();

    it("만료 임박(≤7일) READY 카드에 'D-day' 칩을 노출한다", () => {
      renderCard({
        ...baseCall,
        startedAt: nearExpiry,
        durationSec: 200,
        analysisStatus: "READY",
        analysisId: null,
      });
      expect(screen.getByLabelText(/분석 기한 \d+일 남음/)).toBeInTheDocument();
      expect(screen.getByText(/만료 D-\d+/)).toBeInTheDocument();
    });

    it("만료 임박 FAILED 카드에도 칩을 노출한다 (재분석도 녹음 필요)", () => {
      renderCard({
        ...baseCall,
        startedAt: nearExpiry,
        durationSec: 200,
        analysisStatus: "FAILED",
        analysisId: 100,
      });
      expect(screen.getByLabelText(/분석 기한 \d+일 남음/)).toBeInTheDocument();
    });

    it("최근 통화(임박 아님)에는 칩을 노출하지 않는다", () => {
      renderCard({ ...baseCall, analysisStatus: "READY", analysisId: null });
      expect(screen.queryByLabelText(/분석 기한/)).not.toBeInTheDocument();
    });

    it("임박이어도 COMPLETED 면 칩 대신 '분석보기' 만 노출한다", () => {
      renderCard({
        ...baseCall,
        startedAt: nearExpiry,
        durationSec: 200,
        analysisStatus: "COMPLETED",
        analysisId: 100,
      });
      expect(screen.queryByLabelText(/분석 기한/)).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "분석보기" }),
      ).toBeInTheDocument();
    });

    it("EXPIRED 면 '기간 만료' 비활성 버튼을 노출하고 '분석하기' 는 없다", () => {
      renderCard({
        ...baseCall,
        startedAt: new Date(2026, 2, 20, 12, 0).toISOString(),
        durationSec: 200,
        analysisStatus: "EXPIRED",
        analysisId: null,
      });
      expect(screen.getByRole("button", { name: "기간 만료" })).toBeDisabled();
      expect(
        screen.queryByRole("button", { name: "분석하기" }),
      ).not.toBeInTheDocument();
    });

    it("1분 미만 EXPIRED 통화는 버튼 자체를 숨긴다 (분석 불가 통화)", () => {
      renderCard({
        ...baseCall,
        startedAt: new Date(2026, 2, 20, 12, 0).toISOString(),
        durationSec: 30,
        analysisStatus: "EXPIRED",
        analysisId: null,
      });
      expect(
        screen.queryByRole("button", { name: "기간 만료" }),
      ).not.toBeInTheDocument();
    });
  });
});
