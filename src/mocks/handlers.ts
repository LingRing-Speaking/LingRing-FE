import { http, HttpResponse } from "msw";
import { env } from "@/config/env";
import type { CallHistoryItem } from "@/domains/callHistory/types";

const FAKE_PARTNER_NAMES = [
  "Jenson", "Minji", "Sophie", "David", "Emma", "Daniel", "Hannah",
  "Olivia", "Noah", "Amelia", "Liam", "Yujin", "Sora", "Junho",
];

// 0~1300시간(약 54일) 전 사이에서 50개의 통화를 분산 배치.
// 매일 자동으로 오늘/이번 주/이번 달/지난 달들에 분포가 갱신됨.
function generateFakeCalls(_userId: number, n: number): CallHistoryItem[] {
  const now = Date.now();
  return Array.from({ length: n }, (_, i) => {
    // 비선형 분포: 처음 몇 개는 오늘/이번 주에 몰리고, 뒤로 갈수록 멀어진다.
    const hoursAgo = Math.round((i * i) / 2 + i * 2);
    const startedAt = new Date(now - hoursAgo * 3600_000).toISOString();
    const durationSec = 60 + ((i * 37) % 540); // 1:00 ~ 9:59
    return {
      id: i + 1,
      partner: {
        id: 1000 + i,
        name: FAKE_PARTNER_NAMES[i % FAKE_PARTNER_NAMES.length],
      },
      startedAt,
      durationSec,
      analyzed: i % 3 !== 0, // 3개 중 1개는 미분석 → "분석하기" 버튼이 골고루 노출
    };
  });
}

export const handlers = [
  http.get(`${env.apiBaseUrl}/auth/me`, () => {
    return HttpResponse.json({
      data: { id: 1, nickname: "lee-tiger-1234" },
      status: 200,
      message: "OK",
    });
  }),

  http.post(`${env.apiBaseUrl}/auth/refresh`, () => {
    return HttpResponse.json({
      data: { accessToken: "mock-access", refreshToken: "mock-refresh" },
      status: 200,
      message: "OK",
    });
  }),

  http.get(`${env.apiBaseUrl}/users/:userId/my`, ({ params }) => {
    return HttpResponse.json({
      data: { id: Number(params.userId), name: "Lee" },
      status: 200,
      message: "OK",
    });
  }),

  http.get(`${env.apiBaseUrl}/users/:userId/stats`, ({ params }) => {
    return HttpResponse.json({
      data: {
        userId: Number(params.userId),
        level: "INTERMEDIATE",
        mannerTemperature: 36.5,
        totalCallCount: 23,
        currentStreakDays: 7,
        expressionCount: 42,
        lastStudyDate: "2026-04-24",
      },
      status: 200,
      message: "OK",
    });
  }),

  http.get(`${env.apiBaseUrl}/users/:userId/expressions`, ({ params }) => {
    const userId = Number(params.userId);
    return HttpResponse.json({
      data: {
        items: [
          {
            id: 1,
            userId,
            expression:
              "I'd appreciate it if you could send the report by Friday.",
            meaning: "금요일까지 보고서를 보내주시면 감사하겠습니다.",
            createdAt: "2026-04-25T12:34:56.123456",
          },
          {
            id: 2,
            userId,
            expression: "That's a fair point, but I'd like to add something.",
            meaning: "좋은 지적이에요. 다만 한 가지 덧붙이고 싶어요.",
            createdAt: "2026-04-24T10:00:00.000000",
          },
          {
            id: 3,
            userId,
            expression: "Sorry, could you say that one more time?",
            meaning: "죄송한데 한 번만 더 말씀해주실 수 있을까요?",
            createdAt: "2026-04-23T09:15:00.000000",
          },
        ],
        hasNext: false,
      },
      status: 200,
      message: "OK",
    });
  }),

  http.get(`${env.apiBaseUrl}/recommended-expressions/daily`, () => {
    return HttpResponse.json({
      data: {
        id: 1,
        expression: "Sounds good to me.",
        meaning: "좋아요, 저도 동의해요 — 가볍게 맞장구칠 때",
        createdAt: "2026-04-25T08:00:00.000000",
      },
      status: 200,
      message: "OK",
    });
  }),

  http.get(`${env.apiBaseUrl}/icebreakers`, ({ request }) => {
    const url = new URL(request.url);
    const count = Number(url.searchParams.get("count") ?? "5");
    const items = Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      expression: `Sample expression ${i + 1}`,
      meaning: `샘플 표현 ${i + 1}`,
      createdAt: "2026-04-28T22:34:56.123456",
    }));
    return HttpResponse.json({
      data: { items },
      status: 200,
      message: "OK",
    });
  }),

  http.post(`${env.apiBaseUrl}/users/:userId/matching`, () => {
    return HttpResponse.json({
      data: null,
      status: 204,
      message: "NO_CONTENT",
    });
  }),

  http.get(`${env.apiBaseUrl}/users/:userId/matching`, () => {
    return HttpResponse.json({
      data: { status: "WAITING", partnerId: null, roomId: null },
      status: 200,
      message: "OK",
    });
  }),

  http.delete(`${env.apiBaseUrl}/users/:userId/matching`, () => {
    return HttpResponse.json({
      data: null,
      status: 204,
      message: "NO_CONTENT",
    });
  }),

  http.get(`${env.apiBaseUrl}/users/:userId/calls`, ({ request, params }) => {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get("page") ?? 0);
    const size = Number(url.searchParams.get("size") ?? 20);
    const userId = Number(params.userId);
    const all = generateFakeCalls(userId, 50);
    const slice = all.slice(page * size, page * size + size);
    return HttpResponse.json({
      data: { items: slice, hasNext: (page + 1) * size < all.length },
      status: 200,
      message: "OK",
    });
  }),
];
