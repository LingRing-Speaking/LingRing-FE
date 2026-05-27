import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { env } from "@/config/env";
import { server } from "@/mocks/server";
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

    it("'분석하기' 클릭 시 ['calls'] 캐시가 응답의 analysisId + PROCESSING 으로 갱신되며, 결과 페이지로 이동하지 않는다", async () => {
      server.use(
        http.post(`${env.apiBaseUrl}/api/v1/calls/:callId/analysis`, () =>
          HttpResponse.json(
            { data: { analysisId: 777 }, status: 202, message: "ACCEPTED" },
            { status: 202 },
          ),
        ),
      );

      const { queryClient } = renderCard({
        ...baseCall,
        analysisStatus: "READY",
        analysisId: null,
      });
      await userEvent.click(screen.getByRole("button", { name: "분석하기" }));

      await waitFor(() => {
        const cache = queryClient.getQueryData<{
          pages: { items: CallHistoryItem[] }[];
        }>(["calls"]);
        expect(cache?.pages[0]?.items[0]?.analysisId).toBe(777);
        expect(cache?.pages[0]?.items[0]?.analysisStatus).toBe("PROCESSING");
      });

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

    it("'재분석' 클릭 시 분석을 다시 트리거하고 PROCESSING 으로 캐시가 갱신된다", async () => {
      server.use(
        http.post(`${env.apiBaseUrl}/api/v1/calls/:callId/analysis`, () =>
          HttpResponse.json(
            { data: { analysisId: 888 }, status: 202, message: "ACCEPTED" },
            { status: 202 },
          ),
        ),
      );

      const { queryClient } = renderCard({
        ...baseCall,
        analysisStatus: "FAILED",
        analysisId: 100,
      });
      await userEvent.click(screen.getByRole("button", { name: "재분석" }));

      await waitFor(() => {
        const cache = queryClient.getQueryData<{
          pages: { items: CallHistoryItem[] }[];
        }>(["calls"]);
        expect(cache?.pages[0]?.items[0]?.analysisId).toBe(888);
        expect(cache?.pages[0]?.items[0]?.analysisStatus).toBe("PROCESSING");
      });
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
});
