import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { server } from "@/mocks/server";
import { renderWithQueryClient } from "../../../test/utils/renderWithQueryClient";
import { MatchConfirmModal } from "./MatchConfirmModal";

const futureDeadline = () => new Date(Date.now() + 15000).toISOString();

describe("MatchConfirmModal", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("partnerId 의 프로필 정보를 표시한다", async () => {
    server.use(
      http.get("http://localhost:3000/api/v1/users/2", () =>
        HttpResponse.json({
          data: {
            id: 2,
            nickname: "Sophie",
            profileImage: null,
            level: "INTERMEDIATE",
            mannerTemperature: 36.5,
          },
          status: 200,
          message: "OK",
        }),
      ),
    );

    renderWithQueryClient(
      <MatchConfirmModal
        partnerId={2}
        confirmDeadline={futureDeadline()}
        onAccept={vi.fn()}
        onDecline={vi.fn()}
      />,
    );

    expect(await screen.findByText("Sophie")).toBeInTheDocument();
    expect(screen.getByText("Intermediate")).toBeInTheDocument();
    expect(screen.getByText(/36\.5°C/)).toBeInTheDocument();
  });

  it("수락 버튼을 누르면 onAccept 가 호출된다", async () => {
    const onAccept = vi.fn();
    const user = userEvent.setup();

    renderWithQueryClient(
      <MatchConfirmModal
        partnerId={2}
        confirmDeadline={futureDeadline()}
        onAccept={onAccept}
        onDecline={vi.fn()}
      />,
    );

    await screen.findByText("Sophie");
    await user.click(screen.getByRole("button", { name: "수락" }));

    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  it("거절 버튼을 누르면 onDecline 이 호출된다", async () => {
    const onDecline = vi.fn();
    const user = userEvent.setup();

    renderWithQueryClient(
      <MatchConfirmModal
        partnerId={2}
        confirmDeadline={futureDeadline()}
        onAccept={vi.fn()}
        onDecline={onDecline}
      />,
    );

    await screen.findByText("Sophie");
    await user.click(screen.getByRole("button", { name: "거절" }));

    expect(onDecline).toHaveBeenCalledTimes(1);
  });

  it("수락 후 버튼 라벨이 '수락함'으로 바뀌고 두 버튼이 disabled, 대기 힌트가 표시된다", async () => {
    const user = userEvent.setup();

    renderWithQueryClient(
      <MatchConfirmModal
        partnerId={2}
        confirmDeadline={futureDeadline()}
        onAccept={vi.fn()}
        onDecline={vi.fn()}
      />,
    );

    await screen.findByText("Sophie");
    await user.click(screen.getByRole("button", { name: "수락" }));

    const acceptedBtn = screen.getByRole("button", { name: /수락함/ });
    expect(acceptedBtn).toBeDisabled();
    expect(screen.getByRole("button", { name: "거절" })).toBeDisabled();
    expect(screen.getByText("상대 응답을 기다리는 중…")).toBeInTheDocument();
  });

  it("거절 후 두 버튼이 disabled 되고 안내 힌트가 표시된다", async () => {
    const user = userEvent.setup();

    renderWithQueryClient(
      <MatchConfirmModal
        partnerId={2}
        confirmDeadline={futureDeadline()}
        onAccept={vi.fn()}
        onDecline={vi.fn()}
      />,
    );

    await screen.findByText("Sophie");
    await user.click(screen.getByRole("button", { name: "거절" }));

    expect(screen.getByRole("button", { name: "수락" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "거절" })).toBeDisabled();
    expect(screen.getByText("매칭 페이지로 돌아갑니다…")).toBeInTheDocument();
  });

  it("수락 후에는 onAccept 가 추가 호출되지 않는다", async () => {
    const onAccept = vi.fn();
    const user = userEvent.setup();

    renderWithQueryClient(
      <MatchConfirmModal
        partnerId={2}
        confirmDeadline={futureDeadline()}
        onAccept={onAccept}
        onDecline={vi.fn()}
      />,
    );

    await screen.findByText("Sophie");
    const acceptBtn = screen.getByRole("button", { name: "수락" });
    await user.click(acceptBtn);
    // disabled 상태에서 추가 클릭 시도
    await user.click(screen.getByRole("button", { name: /수락함/ }));

    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  it("deadline 이 만료되면 onTimeout 을 1회 호출한다", async () => {
    const onTimeout = vi.fn();
    const pastDeadline = new Date(Date.now() - 1000).toISOString();

    renderWithQueryClient(
      <MatchConfirmModal
        partnerId={2}
        confirmDeadline={pastDeadline}
        onAccept={vi.fn()}
        onDecline={vi.fn()}
        onTimeout={onTimeout}
      />,
    );

    await waitFor(() => expect(onTimeout).toHaveBeenCalledTimes(1));
  });

  it("수락 이후 deadline 이 만료되어도 onTimeout 은 호출되지 않는다", async () => {
    const onTimeout = vi.fn();
    const user = userEvent.setup();
    // 곧 만료될 deadline (300ms 후)
    const soonDeadline = new Date(Date.now() + 300).toISOString();

    renderWithQueryClient(
      <MatchConfirmModal
        partnerId={2}
        confirmDeadline={soonDeadline}
        onAccept={vi.fn()}
        onDecline={vi.fn()}
        onTimeout={onTimeout}
      />,
    );

    await screen.findByText("Sophie");
    await user.click(screen.getByRole("button", { name: "수락" }));

    // deadline 이 지나가도 onTimeout 은 호출 안 됨
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(onTimeout).not.toHaveBeenCalled();
  });

  describe("응답 남은 시간 진행바", () => {
    const FIXED_NOW = new Date("2026-01-01T00:00:00Z");
    const NOMINAL_WINDOW_MS = 15000;
    // 막대는 iOS WKWebView 합성 레이어 고스트를 피하려 width 대신 transform: scaleX 로
    // 채운다. 잔여 시간 비율을 scaleX 가 반영하는지 검증한다.
    const barTransform = () =>
      screen.getByTestId("confirm-countdown-bar").style.transform;

    it("윈도우 시작 시 진행바가 가득 차 있다 (scaleX 1)", () => {
      vi.useFakeTimers();
      vi.setSystemTime(FIXED_NOW);
      const deadline = new Date(Date.now() + NOMINAL_WINDOW_MS).toISOString();

      renderWithQueryClient(
        <MatchConfirmModal
          partnerId={2}
          confirmDeadline={deadline}
          onAccept={vi.fn()}
          onDecline={vi.fn()}
        />,
      );

      expect(barTransform()).toContain("scaleX(1)");
    });

    it("시간이 흐르면 진행바(scaleX)가 잔여 비율만큼 줄어든다", () => {
      vi.useFakeTimers();
      vi.setSystemTime(FIXED_NOW);
      const deadline = new Date(Date.now() + NOMINAL_WINDOW_MS).toISOString();

      renderWithQueryClient(
        <MatchConfirmModal
          partnerId={2}
          confirmDeadline={deadline}
          onAccept={vi.fn()}
          onDecline={vi.fn()}
        />,
      );

      expect(barTransform()).toContain("scaleX(1)");

      // 윈도우의 절반(7.5초) 경과 → 잔여 비율 0.5
      act(() => {
        vi.advanceTimersByTime(NOMINAL_WINDOW_MS / 2);
      });

      expect(barTransform()).toContain("scaleX(0.5)");
    });
  });
});
