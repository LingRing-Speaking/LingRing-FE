import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { server } from "@/mocks/server";
import { renderWithQueryClient } from "../../../test/utils/renderWithQueryClient";
import { CallInvitePage } from "./CallInvitePage";

const BASE = "http://localhost:3000/api/v1";

function renderPage(initialEntry = "/call-invite/2") {
  return renderWithQueryClient(
    <Routes>
      <Route path="/call-invite/:inviteeId" element={<CallInvitePage />} />
      <Route path="/call/:roomId" element={<CallStub />} />
      <Route path="/friends" element={<div>친구 목록 화면</div>} />
    </Routes>,
    { initialEntries: [initialEntry] },
  );
}

let capturedCallState: { partnerId?: number; callId?: number | null } | null = null;
function CallStub() {
  capturedCallState = useLocation().state as typeof capturedCallState;
  return <div>통화 화면 stub</div>;
}

describe("CallInvitePage", () => {
  it("마운트 시 inviteeUserId 로 초대 POST 를 1회 송신하고 '통화를 거는 중' 을 보여준다", async () => {
    let captured: unknown;
    let postCount = 0;
    server.use(
      http.post(`${BASE}/call-invitations`, async ({ request }) => {
        postCount++;
        captured = await request.json();
        return HttpResponse.json({ data: null, status: 204, message: "NO_CONTENT" });
      }),
      // POST 를 오버라이드하면 목 내부 상태가 안 만들어지므로 GET 도 RINGING 으로 고정
      http.get(`${BASE}/call-invitations/outgoing`, () =>
        HttpResponse.json({
          data: { status: "RINGING", roomId: null, callId: null },
          status: 200,
          message: "OK",
        }),
      ),
    );

    renderPage();

    await waitFor(() => expect(postCount).toBe(1));
    expect(captured).toEqual({ inviteeUserId: 2 });
    expect(await screen.findByText("통화를 거는 중…")).toBeInTheDocument();
    // 기본 목 프로필(/users/:id) 닉네임
    expect(await screen.findByText("Sophie")).toBeInTheDocument();
  });

  it("inviteeId 가 숫자가 아니면 친구 목록으로 돌려보낸다", async () => {
    renderPage("/call-invite/abc");

    expect(await screen.findByText("친구 목록 화면")).toBeInTheDocument();
  });

  it("ACCEPTED 를 받으면 /call/:roomId 로 navigate 하고 partnerId·callId 를 state 로 넘긴다", async () => {
    capturedCallState = null;
    server.use(
      http.get(`${BASE}/call-invitations/outgoing`, () =>
        HttpResponse.json({
          data: { status: "ACCEPTED", roomId: "room-7", callId: 42 },
          status: 200,
          message: "OK",
        }),
      ),
    );

    renderPage();

    expect(await screen.findByText("통화 화면 stub")).toBeInTheDocument();
    expect(capturedCallState).toEqual({ partnerId: 2, callId: 42 });
  });

  it("ACCEPTED 후 navigate 시에는 취소 DELETE 를 보내지 않는다", async () => {
    let deleteCount = 0;
    server.use(
      http.get(`${BASE}/call-invitations/outgoing`, () =>
        HttpResponse.json({
          data: { status: "ACCEPTED", roomId: "room-7", callId: 42 },
          status: 200,
          message: "OK",
        }),
      ),
      http.delete(`${BASE}/call-invitations/outgoing`, () => {
        deleteCount++;
        return HttpResponse.json({ data: null, status: 204, message: "NO_CONTENT" });
      }),
    );

    renderPage();

    await screen.findByText("통화 화면 stub");
    await new Promise((r) => setTimeout(r, 50));
    expect(deleteCount).toBe(0);
  });

  it("DECLINED 를 받으면 거절 안내를 보여준다", async () => {
    server.use(
      http.get(`${BASE}/call-invitations/outgoing`, () =>
        HttpResponse.json({
          data: { status: "DECLINED", roomId: null, callId: null },
          status: 200,
          message: "OK",
        }),
      ),
    );

    renderPage();

    expect(await screen.findByText("상대방이 통화를 거절했어요")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "친구 목록으로" })).toBeInTheDocument();
  });

  it("NONE(만료) 을 받으면 응답 없음 안내를 보여준다", async () => {
    server.use(
      http.get(`${BASE}/call-invitations/outgoing`, () =>
        HttpResponse.json({
          data: { status: "NONE", roomId: null, callId: null },
          status: 200,
          message: "OK",
        }),
      ),
    );

    renderPage();

    expect(await screen.findByText("응답이 없어요")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "친구 목록으로" })).toBeInTheDocument();
  });

  it("결과 화면의 '친구 목록으로' 클릭 시 /friends 로 이동하고 취소 DELETE 는 보내지 않는다", async () => {
    const user = userEvent.setup();
    let deleteCount = 0;
    server.use(
      http.get(`${BASE}/call-invitations/outgoing`, () =>
        HttpResponse.json({
          data: { status: "DECLINED", roomId: null, callId: null },
          status: 200,
          message: "OK",
        }),
      ),
      http.delete(`${BASE}/call-invitations/outgoing`, () => {
        deleteCount++;
        return HttpResponse.json({ data: null, status: 204, message: "NO_CONTENT" });
      }),
    );

    renderPage();

    await user.click(await screen.findByRole("button", { name: "친구 목록으로" }));

    expect(await screen.findByText("친구 목록 화면")).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 50));
    expect(deleteCount).toBe(0);
  });

  it("초대 POST 가 409 로 실패하면 연결 불가 안내를 보여준다", async () => {
    server.use(
      http.post(`${BASE}/call-invitations`, () =>
        HttpResponse.json({ data: null, status: 409, message: "CONFLICT" }, { status: 409 }),
      ),
    );

    renderPage();

    expect(await screen.findByText("지금은 통화를 연결할 수 없어요")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "친구 목록으로" })).toBeInTheDocument();
  });

  it("초대 POST 가 실패한 채 언마운트되면 취소 DELETE 를 보내지 않는다", async () => {
    let deleteCount = 0;
    server.use(
      http.post(`${BASE}/call-invitations`, () =>
        HttpResponse.json({ data: null, status: 409, message: "CONFLICT" }, { status: 409 }),
      ),
      http.delete(`${BASE}/call-invitations/outgoing`, () => {
        deleteCount++;
        return HttpResponse.json({ data: null, status: 204, message: "NO_CONTENT" });
      }),
    );

    const { unmount } = renderPage();
    await screen.findByText("지금은 통화를 연결할 수 없어요");

    unmount();

    await new Promise((r) => setTimeout(r, 50));
    expect(deleteCount).toBe(0);
  });

  it("벨 울리는 중 취소 버튼 클릭 시 /friends 로 이동하고 취소 DELETE 를 1회 송신한다", async () => {
    const user = userEvent.setup();
    let deleteCount = 0;
    server.use(
      http.delete(`${BASE}/call-invitations/outgoing`, () => {
        deleteCount++;
        return HttpResponse.json({ data: null, status: 204, message: "NO_CONTENT" });
      }),
    );

    renderPage();

    await screen.findByText("통화를 거는 중…");
    // POST mutation 이 settled 될 시간 부여
    await new Promise((r) => setTimeout(r, 50));

    await user.click(screen.getByRole("button", { name: "취소" }));

    expect(await screen.findByText("친구 목록 화면")).toBeInTheDocument();
    await waitFor(() => expect(deleteCount).toBe(1));
  });

  it("벨 울리는 중 언마운트되면 취소 DELETE 를 1회 송신한다", async () => {
    let deleteCount = 0;
    server.use(
      http.delete(`${BASE}/call-invitations/outgoing`, () => {
        deleteCount++;
        return HttpResponse.json({ data: null, status: 204, message: "NO_CONTENT" });
      }),
    );

    const { unmount } = renderPage();
    await screen.findByText("통화를 거는 중…");
    await new Promise((r) => setTimeout(r, 50));

    unmount();

    await waitFor(() => expect(deleteCount).toBe(1));
  });
});
