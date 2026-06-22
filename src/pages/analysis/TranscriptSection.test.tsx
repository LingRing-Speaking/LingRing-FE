import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { env } from "@/config/env";
import { useAuthStore } from "@/domains/auth/store";
import { server } from "@/mocks/server";
import { TranscriptSection } from "./TranscriptSection";

const ME = 1;
const PARTNER = 2;

function renderSection(callId: number) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return render(<TranscriptSection callId={callId} />, { wrapper });
}

function mockTranscript(callId: number, segments: unknown[]) {
  server.use(
    http.get(`${env.apiBaseUrl}/api/v1/calls/${callId}/transcript`, () =>
      HttpResponse.json({
        data: { callId, segments },
        status: 200,
        message: "OK",
      }),
    ),
  );
}

beforeAll(() => {
  useAuthStore.setState({
    user: { id: ME, nickname: "me", profileImage: null },
    accessToken: "a",
    refreshToken: "r",
    isAuthenticated: true,
  });
});

afterAll(() => {
  useAuthStore.setState({
    user: null,
    accessToken: null,
    refreshToken: null,
    isAuthenticated: false,
  });
});

describe("TranscriptSection", () => {
  it("기본은 접힌 상태 — 토글 버튼만 보이고 대화는 숨겨져 있다", () => {
    mockTranscript(10, [{ userId: PARTNER, startSec: 0, endSec: 1, text: "Hidden line." }]);

    renderSection(10);

    expect(screen.getByRole("button", { name: "전체 대화 보기" })).toBeInTheDocument();
    expect(screen.queryByText("Hidden line.")).not.toBeInTheDocument();
  });

  it("토글을 누르면 transcript 를 불러와 발화 텍스트를 렌더한다", async () => {
    mockTranscript(11, [
      { userId: PARTNER, startSec: 0, endSec: 2, text: "How was your weekend?" },
      { userId: ME, startSec: 65.2, endSec: 68, text: "I went to Busan with friends." },
    ]);

    renderSection(11);
    fireEvent.click(screen.getByRole("button", { name: "전체 대화 보기" }));

    expect(await screen.findByText("I went to Busan with friends.")).toBeInTheDocument();
    expect(screen.getByText("How was your weekend?")).toBeInTheDocument();
  });

  it("본인 userId 발화는 me, 그 외는 partner 로 화자를 구분한다", async () => {
    mockTranscript(12, [
      { userId: PARTNER, startSec: 0, endSec: 2, text: "Partner line." },
      { userId: ME, startSec: 3, endSec: 5, text: "My line." },
    ]);

    renderSection(12);
    fireEvent.click(screen.getByRole("button", { name: "전체 대화 보기" }));

    await screen.findByText("My line.");
    expect(screen.getByText("My line.").closest("[data-speaker]")).toHaveAttribute(
      "data-speaker",
      "me",
    );
    expect(screen.getByText("Partner line.").closest("[data-speaker]")).toHaveAttribute(
      "data-speaker",
      "partner",
    );
  });

  it("startSec 를 '분 초' 로 표시한다 (65.2 → 1분 5초, 1분 미만은 초만)", async () => {
    mockTranscript(13, [
      { userId: ME, startSec: 2.4, endSec: 4, text: "Sub minute." },
      { userId: ME, startSec: 65.2, endSec: 68, text: "Over minute." },
    ]);

    renderSection(13);
    fireEvent.click(screen.getByRole("button", { name: "전체 대화 보기" }));

    await screen.findByText("Over minute.");
    expect(screen.getByText("1분 5초")).toBeInTheDocument();
    expect(screen.getByText("2초")).toBeInTheDocument();
  });

  it("segments 가 비어 있으면 안내 문구를 보여준다", async () => {
    mockTranscript(14, []);

    renderSection(14);
    fireEvent.click(screen.getByRole("button", { name: "전체 대화 보기" }));

    expect(await screen.findByText("아직 대화 내용이 없어요.")).toBeInTheDocument();
  });

  it("에러가 나면 단일 안내 문구를 보여준다", async () => {
    server.use(
      http.get(`${env.apiBaseUrl}/api/v1/calls/15/transcript`, () =>
        HttpResponse.json(
          {
            data: null,
            status: 409,
            message: "통화 transcript가 아직 준비되지 않았습니다.",
          },
          { status: 409 },
        ),
      ),
    );

    renderSection(15);
    fireEvent.click(screen.getByRole("button", { name: "전체 대화 보기" }));

    expect(await screen.findByText("대화를 불러오지 못했어요.")).toBeInTheDocument();
  });
});
