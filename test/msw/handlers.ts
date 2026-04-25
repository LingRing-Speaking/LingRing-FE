import { http, HttpResponse } from "msw";
import { env } from "@/config/env";

export const handlers = [
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
];
