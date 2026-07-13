import { http, HttpResponse } from "msw";
import { env } from "@/config/env";
import type {
  AnalysisResult,
  AnalysisStatus,
  CallHistoryItem,
} from "@/domains/callHistory/types";

const API_PREFIX = "/api/v1";
const apiUrl = (path: string) => `${env.apiBaseUrl}${API_PREFIX}${path}`;

// 사용자가 "분석하기" 를 누르면 POST 가 호출되고 그 callId 에 대한 analysisId 가
// 발급되며, 발급 시각이 기록된다. PROCESSING_DURATION_MS 동안은 PROCESSING 으로
// 응답되고 그 이후 COMPLETED 로 전환된다. 시드된 (이미 옛날에 끝난) 분석은
// triggeredAt 이 없으므로 즉시 COMPLETED 로 본다.
const PROCESSING_DURATION_MS = 6000;
const analysisIdByCallId = new Map<number, number>();
const triggeredAtByAnalysisId = new Map<number, number>();
let nextAnalysisId = 1000;

// 녹음 업로드 중(WAITING_RECORDINGS) 시뮬레이션. 지정된 통화는 첫 조회 시각을
// 기록해 그로부터 RECORDING_UPLOAD_DURATION_MS 동안 WAITING_RECORDINGS 로 응답하고,
// 이후 READY 로 전환된다. 목록 폴링이 이 전환을 따라가 "대기중"→"분석하기" 가 된다.
const RECORDING_UPLOAD_DURATION_MS = 9000;
const RECORDING_UPLOAD_DEMO_CALL_ID = 4;
const recordingUploadStartedAtByCallId = new Map<number, number>();

function isRecordingStillUploading(callId: number): boolean {
  let startedAt = recordingUploadStartedAtByCallId.get(callId);
  if (startedAt == null) {
    startedAt = Date.now();
    recordingUploadStartedAtByCallId.set(callId, startedAt);
  }
  return Date.now() - startedAt < RECORDING_UPLOAD_DURATION_MS;
}

/** 테스트 간 모듈 레벨 상태를 초기화한다. */
export function resetMockState() {
  analysisIdByCallId.clear();
  triggeredAtByAnalysisId.clear();
  recordingUploadStartedAtByCallId.clear();
  nextAnalysisId = 1000;
}

// 분석 row 가 존재하는 경우의 상태. READY 는 row 자체가 없는 상태라 여기서 다루지 않음.
function statusForAnalysisId(
  analysisId: number,
): "PROCESSING" | "COMPLETED" | "FAILED" {
  // FAILED 시뮬: 끝자리 9 인 시드 analysisId 는 항상 FAILED 응답
  if (analysisId % 10 === 9) return "FAILED";
  const triggeredAt = triggeredAtByAnalysisId.get(analysisId);
  if (triggeredAt == null) return "COMPLETED";
  return Date.now() - triggeredAt < PROCESSING_DURATION_MS
    ? "PROCESSING"
    : "COMPLETED";
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
    const hoursAgo = Math.round((i * i) / 2 + i * 2);
    const startedAt = new Date(now - hoursAgo * 3600_000).toISOString();
    const durationSec = 60 + ((i * 37) % 540);
    // 7번째마다 partner=null (탈퇴한 사용자) → "알 수 없음" 시연
    const partner =
      i % 7 === 6
        ? null
        : {
            id: 1000 + i,
            name: FAKE_PARTNER_NAMES[i % FAKE_PARTNER_NAMES.length],
            profileImage: null,
          };
    const callId = i + 1;
    // 시드 분포:
    //   i % 3 === 0 → 분석 row 없음 → READY ("분석하기")
    //   i % 9 === 4 → 끝자리 9 인 analysisId → FAILED 시뮬 ("재분석")
    //   그 외       → 일반 analysisId → COMPLETED 시뮬 ("분석 완료")
    let seedAnalysisId: number | null;
    if (i % 3 === 0) {
      seedAnalysisId = null;
    } else if (i % 9 === 4) {
      seedAnalysisId = 10009 + i;
    } else {
      seedAnalysisId = 10000 + i;
    }
    if (seedAnalysisId != null) {
      analysisIdByCallId.set(callId, seedAnalysisId);
    }
    // 사용자가 "분석하기" 를 눌러 동적으로 발급된 analysisId 도 함께 반영.
    const currentAnalysisId = analysisIdByCallId.get(callId) ?? null;
    // 분석 row 가 있으면 그 상태를, 없으면 녹음 업로드 중(WAITING_RECORDINGS) →
    // 업로드 완료(READY) 순으로 본다.
    let analysisStatus: AnalysisStatus;
    if (currentAnalysisId != null) {
      analysisStatus = statusForAnalysisId(currentAnalysisId);
    } else if (
      callId === RECORDING_UPLOAD_DEMO_CALL_ID &&
      isRecordingStillUploading(callId)
    ) {
      analysisStatus = "WAITING_RECORDINGS";
    } else {
      analysisStatus = "READY";
    }
    return {
      id: callId,
      partner,
      startedAt,
      durationSec,
      analysisId: currentAnalysisId,
      analysisStatus,
    };
  });
}

const SAMPLE_RESULT_BASE: Omit<AnalysisResult, "callId" | "userId"> = {
  status: "COMPLETED",
  modelIdentifier: "gpt-4o-mini",
  positives: [
    {
      sentence: "I really enjoyed talking with you today.",
      goodPart: "really enjoyed talking with",
      koMeaning: "오늘 너와 이야기해서 정말 즐거웠어.",
    },
  ],
  mistakes: [
    {
      id: 1,
      tag: "GRAMMAR",
      wrong: "I goed to school yesterday.",
      improved: "I went to school yesterday.",
      reason: "go 의 과거형은 went 입니다.",
      koMeaning: "나는 어제 학교에 갔다.",
      bookmarkId: null,
    },
    {
      id: 2,
      tag: "COLLOCATION",
      wrong: "make a homework",
      improved: "do my homework",
      reason: "homework 는 do 와 결합합니다.",
      koMeaning: "숙제를 하다",
      bookmarkId: null,
    },
  ],
};

// 목에서 찜 등록 시 발급할 표현 id 시퀀스(기존 목 데이터 id 와 겹치지 않게 큰 값부터).
let mockBookmarkSeq = 1000;

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

  http.get(apiUrl("/me/analysis-quota"), () => {
    return HttpResponse.json({
      // nextResetAt 은 오프셋 없는 LocalDateTime(다음 0시, KST 해석).
      data: { freeTicket: 1, paidTicket: 0, nextResetAt: "2026-07-01T00:00:00" },
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

  // 찜 등록. 실제 BE 는 source 로 원본을 조회해 expression/meaning 을 채우지만,
  // 목에서는 생성된 표현을 간단히 고정 문구로 반환한다.
  http.post(apiUrl("/expressions"), async () => {
    mockBookmarkSeq += 1;
    return HttpResponse.json({
      data: {
        id: mockBookmarkSeq,
        userId: 1,
        expression: "Saved expression (mock)",
        meaning: "저장된 표현 (목)",
        createdAt: "2026-07-13T00:00:00.000000",
      },
      status: 201,
      message: "CREATED",
    });
  }),

  // 찜 해제.
  http.delete(apiUrl("/expressions/:id"), () => {
    return HttpResponse.json({
      data: null,
      status: 204,
      message: "NO_CONTENT",
    });
  }),

  http.get(apiUrl("/recommended-expressions/daily"), () => {
    return HttpResponse.json({
      data: {
        id: 1,
        expression: "Sounds good to me.",
        meaning: "좋아요, 저도 동의해요 — 가볍게 맞장구칠 때",
        createdAt: "2026-04-25T08:00:00.000000",
        bookmarkId: null,
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
      bookmarkId: null,
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
    const all = generateFakeCalls(50);
    const slice = all.slice(page * size, page * size + size);
    return HttpResponse.json({
      data: { items: slice, hasNext: (page + 1) * size < all.length },
      status: 200,
      message: "OK",
    });
  }),

  http.get(apiUrl("/calls/:callId/transcript"), ({ params }) => {
    const callId = Number(params.callId);
    // 현재 사용자(/me)는 id 1, 상대는 id 2 로 시뮬. startSec 오름차순.
    return HttpResponse.json({
      data: {
        callId,
        segments: [
          { userId: 2, startSec: 0.0, endSec: 2.4, text: "Hey! How was your weekend?" },
          {
            userId: 1,
            startSec: 2.8,
            endSec: 6.1,
            text: "It was good. I went to Busan with friends.",
          },
          { userId: 2, startSec: 6.5, endSec: 9.0, text: "Oh nice! What did you do there?" },
          {
            userId: 1,
            startSec: 9.4,
            endSec: 14.2,
            text: "We went to the beach and ate seafood. It was amazing.",
          },
        ],
      },
      status: 200,
      message: "OK",
    });
  }),

  http.post(apiUrl("/calls/:callId/analysis"), ({ params }) => {
    const callId = Number(params.callId);
    let analysisId = analysisIdByCallId.get(callId);
    // FAILED 인 기존 분석은 재시도 — 새 analysisId 발급. PROCESSING/COMPLETED 는
    // 멱등으로 같은 ID 그대로 반환.
    if (analysisId != null && statusForAnalysisId(analysisId) === "FAILED") {
      analysisId = undefined;
    }
    if (analysisId == null) {
      analysisId = nextAnalysisId++;
      analysisIdByCallId.set(callId, analysisId);
      triggeredAtByAnalysisId.set(analysisId, Date.now());
    }
    return HttpResponse.json(
      {
        data: { analysisId },
        status: 202,
        message: "ACCEPTED",
      },
      { status: 202 },
    );
  }),

  http.get(apiUrl("/analyses/:analysisId/status"), ({ params }) => {
    const analysisId = Number(params.analysisId);
    return HttpResponse.json({
      data: { status: statusForAnalysisId(analysisId) },
      status: 200,
      message: "OK",
    });
  }),

  http.get(apiUrl("/analyses/:analysisId"), ({ params }) => {
    const analysisId = Number(params.analysisId);
    const status = statusForAnalysisId(analysisId);
    // callId 역추적 — 결과 응답 metadata 용. 매칭 안 되면 0.
    let callId = 0;
    for (const [cId, aId] of analysisIdByCallId.entries()) {
      if (aId === analysisId) {
        callId = cId;
        break;
      }
    }
    if (status === "COMPLETED") {
      return HttpResponse.json({
        data: { ...SAMPLE_RESULT_BASE, callId, userId: 1 },
        status: 200,
        message: "OK",
      });
    }
    return HttpResponse.json({
      data: {
        callId,
        userId: 1,
        status,
        modelIdentifier: null,
        mistakes: [],
        positives: [],
      },
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
