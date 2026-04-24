import { http, HttpResponse } from "msw";

const API_BASE = "http://localhost:3000";

export const handlers = [
  http.get(`${API_BASE}/users/:userId/my`, ({ params }) => {
    return HttpResponse.json({
      data: { id: Number(params.userId), name: "Lee" },
      status: 200,
      message: "OK",
    });
  }),

  http.get(`${API_BASE}/users/:userId/stats`, ({ params }) => {
    return HttpResponse.json({
      data: {
        userId: Number(params.userId),
        level: "INTERMEDIATE",
        mannerTemperature: 36.5,
        totalCallCount: 23,
        currentStreakDays: 7,
        savedExpressionCount: 42,
        lastStudyDate: "2026-04-24",
      },
      status: 200,
      message: "OK",
    });
  }),
];
