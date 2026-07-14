import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { server } from "@/mocks/server";
import { renderWithQueryClient } from "../../../../test/utils/renderWithQueryClient";
import { useIncomingInvitationStore } from "../incomingInvitationStore";
import { IncomingInvitationBanner } from "./IncomingInvitationBanner";

const BASE = "http://localhost:3000/api/v1";

const futureDeadline = (ms = 30_000) => new Date(Date.now() + ms).toISOString();

const setStoreInvitation = (invitation: { inviterId: number; deadline: string } | null) => {
  act(() => {
    useIncomingInvitationStore.getState().setInvitation(invitation);
  });
};

describe("IncomingInvitationBanner", () => {
  afterEach(() => {
    useIncomingInvitationStore.setState({ invitation: null });
    vi.useRealTimers();
  });

  it("수신 초대가 없으면 아무것도 그리지 않는다", () => {
    renderWithQueryClient(<IncomingInvitationBanner />);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("수신 초대가 있으면 발신자 닉네임과 받기/거절 버튼을 보여준다", async () => {
    renderWithQueryClient(<IncomingInvitationBanner />);

    setStoreInvitation({ inviterId: 2, deadline: futureDeadline() });

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    // 기본 목 프로필(/users/:id)의 닉네임
    expect(await screen.findByText(/Sophie/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "받기" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "거절" })).toBeInTheDocument();
  });

  it("받기 버튼이 거절보다 앞(왼쪽)에 온다", async () => {
    renderWithQueryClient(<IncomingInvitationBanner />);

    setStoreInvitation({ inviterId: 2, deadline: futureDeadline() });
    await screen.findByRole("alert");

    const buttonLabels = screen.getAllByRole("button").map((button) => button.textContent);
    expect(buttonLabels).toEqual(["받기", "거절"]);
  });

  it("하단 게이지가 남은 시간을 보여주고 시간이 흐르면 줄어든다", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    renderWithQueryClient(<IncomingInvitationBanner />);

    setStoreInvitation({ inviterId: 2, deadline: futureDeadline(30_000) });

    const gauge = await screen.findByRole("progressbar");
    expect(Number(gauge.getAttribute("aria-valuenow"))).toBeGreaterThanOrEqual(29);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });

    expect(Number(gauge.getAttribute("aria-valuenow"))).toBeLessThanOrEqual(20);
  });

  it("받기 클릭 → accept 호출 후 /call/:roomId 로 navigate 하고 partnerId·callId 를 state 로 넘긴다", async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${BASE}/call-invitations/accept`, () =>
        HttpResponse.json({
          data: { roomId: "room-9", callId: 5 },
          status: 200,
          message: "OK",
        }),
      ),
    );

    let capturedState: { partnerId?: number; callId?: number | null } | null = null;
    function CallStub() {
      capturedState = useLocation().state as typeof capturedState;
      return <div>통화 화면 stub</div>;
    }

    renderWithQueryClient(
      <>
        <IncomingInvitationBanner />
        <Routes>
          <Route path="/" element={<div>홈</div>} />
          <Route path="/call/:roomId" element={<CallStub />} />
        </Routes>
      </>,
    );

    setStoreInvitation({ inviterId: 2, deadline: futureDeadline() });

    await user.click(await screen.findByRole("button", { name: "받기" }));

    expect(await screen.findByText("통화 화면 stub")).toBeInTheDocument();
    expect(capturedState).toEqual({ partnerId: 2, callId: 5 });
    expect(useIncomingInvitationStore.getState().invitation).toBeNull();
  });

  it("받기가 404(만료·취소된 초대)면 navigate 없이 배너만 닫는다", async () => {
    const user = userEvent.setup();
    // 기본 목이 accept 404 를 반환한다.

    renderWithQueryClient(
      <>
        <IncomingInvitationBanner />
        <Routes>
          <Route path="/" element={<div>홈</div>} />
          <Route path="/call/:roomId" element={<div>통화 화면 stub</div>} />
        </Routes>
      </>,
    );

    setStoreInvitation({ inviterId: 2, deadline: futureDeadline() });

    await user.click(await screen.findByRole("button", { name: "받기" }));

    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(screen.queryByText("통화 화면 stub")).not.toBeInTheDocument();
    expect(useIncomingInvitationStore.getState().invitation).toBeNull();
  });

  it("거절 클릭 → decline 엔드포인트 호출 후 배너를 닫는다", async () => {
    const user = userEvent.setup();
    let declineCount = 0;
    server.use(
      http.post(`${BASE}/call-invitations/decline`, () => {
        declineCount++;
        return HttpResponse.json({ data: null, status: 204, message: "NO_CONTENT" });
      }),
    );

    renderWithQueryClient(<IncomingInvitationBanner />);

    setStoreInvitation({ inviterId: 2, deadline: futureDeadline() });

    await user.click(await screen.findByRole("button", { name: "거절" }));

    await waitFor(() => expect(declineCount).toBe(1));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(useIncomingInvitationStore.getState().invitation).toBeNull();
  });

  it("deadline 이 지나면 배너가 자동으로 사라진다", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    renderWithQueryClient(<IncomingInvitationBanner />);

    setStoreInvitation({ inviterId: 2, deadline: futureDeadline(3000) });
    expect(await screen.findByRole("alert")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3100);
    });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(useIncomingInvitationStore.getState().invitation).toBeNull();
  });

  it("하트비트가 초대를 지우면(발신 취소) 배너가 사라진다", async () => {
    renderWithQueryClient(<IncomingInvitationBanner />);

    setStoreInvitation({ inviterId: 2, deadline: futureDeadline() });
    expect(await screen.findByRole("alert")).toBeInTheDocument();

    setStoreInvitation(null);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
