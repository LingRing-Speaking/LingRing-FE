import { http, HttpResponse } from "msw";
import { env } from "@/config/env";
import type {
  AnalysisStatus,
  CallHistoryItem,
} from "@/domains/callHistory/types";

const API_PREFIX = "/api/v1";
const apiUrl = (path: string) => `${env.apiBaseUrl}${API_PREFIX}${path}`;

// 분석 트리거가 호출된 callId 의 시작 시각을 보관. 시드 데이터에는 분석중 상태가
// 없고, 사용자가 "분석하기" 버튼을 눌러야 IN_PROGRESS 가 켜진다. 6초가 지나면
// 자동으로 COMPLETED 로 간주되어 폴링 + 카드 양쪽이 함께 갱신된다.
const ANALYSIS_DURATION_MS = 6000;
const triggeredAnalysisByCallId = new Map<number, { triggeredAt: number }>();

function effectiveAnalysisStatus(
  callId: number,
  seedStatus: AnalysisStatus,
): AnalysisStatus {
  const entry = triggeredAnalysisByCallId.get(callId);
  if (!entry) return seedStatus;
  const elapsed = Date.now() - entry.triggeredAt;
  return elapsed < ANALYSIS_DURATION_MS ? "IN_PROGRESS" : "COMPLETED";
}

const FAKE_PARTNER_NAMES = [
  "Jenson",
  "Minji",
  "Sophie",
  "David",
  "Emma",
  "Daniel",
  "Hannah",
  "Olivia",
  "Noah",
  "Amelia",
  "Liam",
  "Yujin",
  "Sora",
  "Junho",
];

// 0~1300시간(약 54일) 전 사이에서 50개의 통화를 분산 배치.
// 매일 자동으로 오늘/이번 주/이번 달/지난 달들에 분포가 갱신됨.
function generateFakeCalls(n: number): CallHistoryItem[] {
  const now = Date.now();
  return Array.from({ length: n }, (_, i) => {
    // 비선형 분포: 처음 몇 개는 오늘/이번 주에 몰리고, 뒤로 갈수록 멀어진다.
    const hoursAgo = Math.round((i * i) / 2 + i * 2);
    const startedAt = new Date(now - hoursAgo * 3600_000).toISOString();
    const durationSec = 60 + ((i * 37) % 540); // 1:00 ~ 9:59
    // 7번째마다 partner=null (탈퇴한 사용자) → "알 수 없음" 시연
    const partner =
      i % 7 === 6
        ? null
        : {
            id: 1000 + i,
            name: FAKE_PARTNER_NAMES[i % FAKE_PARTNER_NAMES.length],
            profileImage: null,
          };
    // 시드 분포: 3건 중 1건은 NONE("분석하기"), 나머지는 COMPLETED("분석 보기").
    // IN_PROGRESS 시연은 사용자가 직접 분석하기를 눌러야만 시작된다.
    const seedStatus: AnalysisStatus = i % 3 === 0 ? "NONE" : "COMPLETED";
    return {
      id: i + 1,
      partner,
      startedAt,
      durationSec,
      analysisStatus: seedStatus,
    };
  });
}

export const handlers = [
  http.get(apiUrl("/me"), () => {
    return HttpResponse.json({
      data: { id: 1, nickname: "lee-tiger-1234", profileImage: null },
      status: 200,
      message: "OK",
    });
  }),

  http.get(apiUrl("/users/:userId"), ({ params }) => {
    return HttpResponse.json({
      data: {
        id: Number(params.userId),
        nickname: "Sophie",
        profileImage: null,
        level: "INTERMEDIATE",
        mannerTemperature: 36.5,
      },
      status: 200,
      message: "OK",
    });
  }),

  http.post(apiUrl("/auth/refresh"), () => {
    return HttpResponse.json({
      data: { accessToken: "mock-access", refreshToken: "mock-refresh" },
      status: 200,
      message: "OK",
    });
  }),

  http.post(apiUrl("/auth/logout"), () => {
    return HttpResponse.json({
      data: null,
      status: 204,
      message: "NO_CONTENT",
    });
  }),

  http.post(apiUrl("/me/withdraw"), () => {
    return HttpResponse.json({
      data: null,
      status: 204,
      message: "NO_CONTENT",
    });
  }),

  http.post(apiUrl("/me/agreements"), () => {
    return HttpResponse.json({
      data: {
        user: {
          id: 1,
          nickname: "lee-tiger-1234",
          profileImage: null,
          requiresOnboarding: false,
        },
      },
      status: 200,
      message: "OK",
    });
  }),

  http.get(apiUrl("/me/stats"), () => {
    return HttpResponse.json({
      data: {
        userId: 1,
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

  http.get(apiUrl("/expressions"), () => {
    return HttpResponse.json({
      data: {
        items: [
          {
            id: 1,
            userId: 1,
            expression: "I'd appreciate it if you could send the report by Friday.",
            meaning: "금요일까지 보고서를 보내주시면 감사하겠습니다.",
            createdAt: "2026-04-25T12:34:56.123456",
          },
          {
            id: 2,
            userId: 1,
            expression: "That's a fair point, but I'd like to add something.",
            meaning: "좋은 지적이에요. 다만 한 가지 덧붙이고 싶어요.",
            createdAt: "2026-04-24T10:00:00.000000",
          },
          {
            id: 3,
            userId: 1,
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

  http.get(apiUrl("/recommended-expressions/daily"), () => {
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

  http.get(apiUrl("/icebreakers"), ({ request }) => {
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

  http.post(apiUrl("/me/matching"), () => {
    return HttpResponse.json({
      data: null,
      status: 204,
      message: "NO_CONTENT",
    });
  }),

  http.get(apiUrl("/me/matching"), () => {
    return HttpResponse.json({
      data: {
        status: "WAITING",
        partnerId: null,
        roomId: null,
        callId: null,
        confirmDeadline: null,
      },
      status: 200,
      message: "OK",
    });
  }),

  http.delete(apiUrl("/me/matching"), () => {
    return HttpResponse.json({
      data: null,
      status: 204,
      message: "NO_CONTENT",
    });
  }),

  http.post(apiUrl("/me/matching/accept"), () => {
    return HttpResponse.json({
      data: null,
      status: 204,
      message: "NO_CONTENT",
    });
  }),

  http.post(apiUrl("/me/matching/decline"), () => {
    return HttpResponse.json({
      data: null,
      status: 204,
      message: "NO_CONTENT",
    });
  }),

  http.post(apiUrl("/reports"), () => {
    return HttpResponse.json({
      data: null,
      status: 204,
      message: "NO_CONTENT",
    });
  }),

  http.get(apiUrl("/calls"), ({ request }) => {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get("page") ?? 0);
    const size = Number(url.searchParams.get("size") ?? 20);
    const all = generateFakeCalls(50).map((c) => ({
      ...c,
      analysisStatus: effectiveAnalysisStatus(c.id, c.analysisStatus),
    }));
    const slice = all.slice(page * size, page * size + size);
    return HttpResponse.json({
      data: { items: slice, hasNext: (page + 1) * size < all.length },
      status: 200,
      message: "OK",
    });
  }),

  http.post(apiUrl("/calls/:callId/analyze"), ({ params }) => {
    const callId = Number(params.callId);
    if (!triggeredAnalysisByCallId.has(callId)) {
      triggeredAnalysisByCallId.set(callId, { triggeredAt: Date.now() });
    }
    return HttpResponse.json({
      data: { analysisStatus: effectiveAnalysisStatus(callId, "NONE") },
      status: 200,
      message: "OK",
    });
  }),

  http.get(apiUrl("/calls/:callId/analysis"), ({ params }) => {
    const callId = Number(params.callId);
    const status = effectiveAnalysisStatus(callId, "NONE");
    return HttpResponse.json({
      // result 는 분석 결과 페이지 작업(별도 이슈)에서 채움. 이번 PR 에서는 status 만 소비.
      data: { analysisStatus: status, result: null },
      status: 200,
      message: "OK",
    });
  }),

  http.post(apiUrl("/blocks"), async ({ request }) => {
    const body = (await request.json()) as { blockedUserId?: number };
    return HttpResponse.json(
      {
        data: {
          id: 1,
          userId: 1,
          blockedUserId: body.blockedUserId ?? 0,
          createdAt: "2026-05-17T12:34:56.123456",
        },
        status: 201,
        message: "CREATED",
      },
      { status: 201 },
    );
  }),

  http.delete(apiUrl("/blocks/:blockedUserId"), () => {
    return HttpResponse.json({
      data: null,
      status: 204,
      message: "NO_CONTENT",
    });
  }),

  http.get(apiUrl("/blocks"), ({ request }) => {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get("page") ?? 0);
    const size = Number(url.searchParams.get("size") ?? 20);
    const total = 8;
    const all = Array.from({ length: total }, (_, i) => ({
      id: i + 1,
      blockedUserId: 1000 + i,
      nickname: FAKE_PARTNER_NAMES[i % FAKE_PARTNER_NAMES.length],
      profileImage: null,
      createdAt: new Date(Date.now() - i * 86_400_000).toISOString(),
    }));
    const slice = all.slice(page * size, page * size + size);
    return HttpResponse.json({
      data: { items: slice, hasNext: (page + 1) * size < all.length },
      status: 200,
      message: "OK",
    });
  }),

  // 통화 녹음 업로드 — BE PR #98
  http.post(
    apiUrl("/calls/:callId/recordings/presigned-url"),
    ({ params }) => {
      const callId = params.callId;
      return HttpResponse.json({
        data: {
          url: `https://lingring-recordings-mock.s3.amazonaws.com/call-recordings/${callId}/1/uuid?X-Amz-Signature=mock`,
          key: `call-recordings/${callId}/1/uuid`,
        },
        status: 200,
        message: "OK",
      });
    },
  ),
  http.post(apiUrl("/calls/:callId/recordings"), () => {
    return HttpResponse.json(
      {
        data: { recordingId: 1, status: "UPLOADED" },
        status: 201,
        message: "CREATED",
      },
      { status: 201 },
    );
  }),
];
