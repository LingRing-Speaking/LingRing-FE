import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { env } from "@/config/env";
import { server } from "@/mocks/server";
import { useAuthStore } from "@/domains/auth/store";
import type { AnalysisResult } from "@/domains/callHistory/types";
import { AnalysisResultPage } from "./AnalysisResultPage";

// 결과 화면은 AuthGuard 뒤라 항상 인증 사용자가 있다. CompletedView 가 화자 판별을
// 위해 useUserId 를 호출하므로 파일 전체 동안 본인(id 1)을 세팅해둔다.
beforeAll(() => {
  useAuthStore.setState({
    user: { id: 1, nickname: "me", profileImage: null },
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

function renderAt(analysisId: number) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/analyses/${analysisId}`]}>
        <Routes>
          <Route path="/analyses/:analysisId" element={children} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
  return render(<AnalysisResultPage />, { wrapper });
}

const completedResult: AnalysisResult = {
  callId: 42,
  userId: 1,
  status: "COMPLETED",
  modelIdentifier: "gpt-4o-mini",
  mistakes: [
    {
      tag: "GRAMMAR",
      wrong: "I goed to school yesterday.",
      improved: "I went to school yesterday.",
      reason: "go 의 과거형은 went 입니다.",
      koMeaning: "나는 어제 학교에 갔다.",
    },
  ],
  positives: [
    {
      sentence: "I really enjoyed talking with you today.",
      goodPart: "really enjoyed talking with",
      koMeaning: "오늘 너와 이야기해서 정말 즐거웠어.",
    },
    {
      sentence: "That sounds amazing.",
      goodPart: "sounds amazing",
      koMeaning: "정말 멋지게 들려.",
    },
  ],
};

describe("AnalysisResultPage", () => {
  it("status 가 PROCESSING 이면 분석 진행 안내 + 스피너가 노출된다", async () => {
    server.use(
      http.get(`${env.apiBaseUrl}/api/v1/analyses/100/status`, () =>
        HttpResponse.json({
          data: { status: "PROCESSING" },
          status: 200,
          message: "OK",
        }),
      ),
    );

    renderAt(100);

    await waitFor(() => {
      expect(screen.getByRole("status", { name: "분석 진행 중" })).toBeInTheDocument();
    });
    expect(screen.getByText(/AI 가 통화 내용을 분석 중이에요/)).toBeInTheDocument();
  });

  it("status 가 FAILED 면 실패 안내가 노출된다", async () => {
    server.use(
      http.get(`${env.apiBaseUrl}/api/v1/analyses/101/status`, () =>
        HttpResponse.json({
          data: { status: "FAILED" },
          status: 200,
          message: "OK",
        }),
      ),
    );

    renderAt(101);

    await waitFor(() => {
      expect(screen.getByText("분석에 실패했어요.")).toBeInTheDocument();
    });
  });

  it("status 가 COMPLETED 면 결과 본문(잘한 점·이렇게 말해보세요) 이 렌더된다", async () => {
    server.use(
      http.get(`${env.apiBaseUrl}/api/v1/analyses/102/status`, () =>
        HttpResponse.json({
          data: { status: "COMPLETED" },
          status: 200,
          message: "OK",
        }),
      ),
      http.get(`${env.apiBaseUrl}/api/v1/analyses/102`, () =>
        HttpResponse.json({
          data: completedResult,
          status: 200,
          message: "OK",
        }),
      ),
    );

    renderAt(102);

    await waitFor(() => {
      expect(screen.getByText("이번 대화에서 잘한 점")).toBeInTheDocument();
    });
    expect(screen.getByText("이렇게 말해보세요")).toBeInTheDocument();
    // positives 2개, mistakes 1개
    expect(screen.getByText(/I really enjoyed talking with you today/)).toBeInTheDocument();
    expect(screen.getByText(/That sounds amazing/)).toBeInTheDocument();
    expect(screen.getByText(/I goed to school yesterday/)).toBeInTheDocument();
    expect(screen.getByText(/I went to school yesterday/)).toBeInTheDocument();
  });

  it("COMPLETED 면 '전체 대화 보기' 토글이 노출된다", async () => {
    server.use(
      http.get(`${env.apiBaseUrl}/api/v1/analyses/104/status`, () =>
        HttpResponse.json({
          data: { status: "COMPLETED" },
          status: 200,
          message: "OK",
        }),
      ),
      http.get(`${env.apiBaseUrl}/api/v1/analyses/104`, () =>
        HttpResponse.json({
          data: completedResult,
          status: 200,
          message: "OK",
        }),
      ),
    );

    renderAt(104);

    expect(
      await screen.findByRole("button", { name: "전체 대화 보기" }),
    ).toBeInTheDocument();
  });

  it("COMPLETED 인데 mistakes/positives 가 모두 빈 배열이면 빈 상태 안내가 보인다", async () => {
    server.use(
      http.get(`${env.apiBaseUrl}/api/v1/analyses/103/status`, () =>
        HttpResponse.json({
          data: { status: "COMPLETED" },
          status: 200,
          message: "OK",
        }),
      ),
      http.get(`${env.apiBaseUrl}/api/v1/analyses/103`, () =>
        HttpResponse.json({
          data: {
            ...completedResult,
            mistakes: [],
            positives: [],
          },
          status: 200,
          message: "OK",
        }),
      ),
    );

    renderAt(103);

    await waitFor(() => {
      expect(
        screen.getByText(/별다른 피드백이 없었어요/),
      ).toBeInTheDocument();
    });
  });

  it("잘못된 analysisId (숫자 아님) 면 잘못된 접근 안내가 보인다", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[`/analyses/not-a-number`]}>
          <Routes>
            <Route
              path="/analyses/:analysisId"
              element={<AnalysisResultPage />}
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByText("잘못된 접근이에요.")).toBeInTheDocument();
  });
});
