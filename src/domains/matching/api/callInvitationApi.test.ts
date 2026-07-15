import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/mocks/server";
import {
  acceptCallInvitation,
  cancelOutgoingInvitation,
  createCallInvitation,
  declineCallInvitation,
  fetchOutgoingInvitation,
} from "./callInvitationApi";

const BASE = "http://localhost:3000/api/v1";

describe("createCallInvitation", () => {
  it("204 응답이면 정상 종료한다", async () => {
    await expect(createCallInvitation(2)).resolves.toBeNull();
  });

  it("inviteeUserId 를 body 로 보낸다", async () => {
    let captured: unknown;
    server.use(
      http.post(`${BASE}/call-invitations`, async ({ request }) => {
        captured = await request.json();
        return HttpResponse.json({ data: null, status: 204, message: "NO_CONTENT" });
      }),
    );

    await createCallInvitation(7);
    expect(captured).toEqual({ inviteeUserId: 7 });
  });

  it("409(수신 슬롯 점유·오프라인) 응답이면 status 409 의 ApiError 를 throw 한다", async () => {
    server.use(
      http.post(`${BASE}/call-invitations`, () =>
        HttpResponse.json(
          { data: null, status: 409, message: "INVITATION_SLOT_OCCUPIED" },
          { status: 409 },
        ),
      ),
    );

    await expect(createCallInvitation(2)).rejects.toMatchObject({
      status: 409,
      message: "INVITATION_SLOT_OCCUPIED",
    });
  });
});

describe("fetchOutgoingInvitation", () => {
  it("기본 응답이면 NONE 상태를 반환한다", async () => {
    const result = await fetchOutgoingInvitation();
    expect(result).toEqual({ status: "NONE", roomId: null, callId: null });
  });

  it("ACCEPTED 응답이면 roomId 와 callId 가 채워져 반환된다", async () => {
    server.use(
      http.get(`${BASE}/call-invitations/outgoing`, () =>
        HttpResponse.json({
          data: { status: "ACCEPTED", roomId: "room-1", callId: 9 },
          status: 200,
          message: "OK",
        }),
      ),
    );

    const result = await fetchOutgoingInvitation();
    expect(result).toEqual({ status: "ACCEPTED", roomId: "room-1", callId: 9 });
  });
});

describe("cancelOutgoingInvitation", () => {
  it("204 응답이면 정상 종료한다 (멱등)", async () => {
    await expect(cancelOutgoingInvitation()).resolves.toBeNull();
  });
});

describe("acceptCallInvitation", () => {
  it("200 응답이면 roomId 와 callId 를 반환한다", async () => {
    server.use(
      http.post(`${BASE}/call-invitations/accept`, () =>
        HttpResponse.json({
          data: { roomId: "room-2", callId: 11 },
          status: 200,
          message: "OK",
        }),
      ),
    );

    await expect(acceptCallInvitation()).resolves.toEqual({ roomId: "room-2", callId: 11 });
  });

  it("초대가 이미 소멸(만료·취소)했으면 status 404 의 ApiError 를 throw 한다", async () => {
    server.use(
      http.post(`${BASE}/call-invitations/accept`, () =>
        HttpResponse.json(
          { data: null, status: 404, message: "CALL_INVITATION_NOT_FOUND" },
          { status: 404 },
        ),
      ),
    );

    await expect(acceptCallInvitation()).rejects.toMatchObject({ status: 404 });
  });
});

describe("declineCallInvitation", () => {
  it("204 응답이면 정상 종료한다", async () => {
    server.use(
      http.post(`${BASE}/call-invitations/decline`, () =>
        HttpResponse.json({ data: null, status: 204, message: "NO_CONTENT" }),
      ),
    );

    await expect(declineCallInvitation()).resolves.toBeNull();
  });

  it("초대가 이미 소멸했으면 status 404 의 ApiError 를 throw 한다", async () => {
    server.use(
      http.post(`${BASE}/call-invitations/decline`, () =>
        HttpResponse.json(
          { data: null, status: 404, message: "CALL_INVITATION_NOT_FOUND" },
          { status: 404 },
        ),
      ),
    );

    await expect(declineCallInvitation()).rejects.toMatchObject({ status: 404 });
  });
});
