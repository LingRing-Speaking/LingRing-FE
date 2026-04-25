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
        savedExpressionCount: 42,
        lastStudyDate: "2026-04-24",
      },
      status: 200,
      message: "OK",
    });
  }),
];
