import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "@/domains/auth/store";
import { createTestQueryClient } from "../../../test/utils/renderWithQueryClient";
import { CallPage } from "./CallPage";

const sessionState = {
  status: "connecting" as
    | "connecting"
    | "connected"
    | "ended"
    | "error",
  errorMessage: null as string | null,
  isMuted: false,
  toggleMute: vi.fn(),
  end: vi.fn(),
  remoteAudioRef: createRef<HTMLAudioElement>(),
};

vi.mock("@/domains/call/hooks/useCallSession", () => ({
  useCallSession: () => sessionState,
}));

beforeEach(() => {
  sessionState.status = "connecting";
  sessionState.errorMessage = null;
  sessionState.isMuted = false;
  sessionState.toggleMute = vi.fn();
  sessionState.end = vi.fn();
  useAuthStore.setState({
    user: { id: 1, nickname: "tester" },
    accessToken: "test-access",
    refreshToken: "test-refresh",
    isAuthenticated: true,
  });
});

afterEach(() => vi.clearAllMocks());

const renderAt = (path: string, state?: { partnerId?: number }) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter
        initialEntries={[{ pathname: path, state: state ?? null }]}
      >
        <Routes>
          <Route path="/call/:roomId" element={<CallPage />} />
          <Route path="/home" element={<div>홈입니다</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe("CallPage", () => {
  it("roomId 또는 partnerId 가 없으면 / 로 리다이렉트한다", () => {
    renderAt("/call/abc");
    expect(screen.getByText("홈입니다")).toBeInTheDocument();
  });

  it("connecting 상태에서는 '연결 중' 라벨을 보여준다", () => {
    sessionState.status = "connecting";
    renderAt("/call/abc", { partnerId: 2 });

    expect(screen.getByText(/연결 중/)).toBeInTheDocument();
  });

  it("connected 상태에서는 타이머와 mute/speaker/end 버튼을 보여준다", () => {
    sessionState.status = "connected";
    renderAt("/call/abc", { partnerId: 2 });

    expect(screen.getByText("00:00")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "음소거" }),
    ).toBeEnabled();
    expect(screen.getByRole("button", { name: "스피커" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "통화 종료" }),
    ).toBeInTheDocument();
  });

  it("mute 버튼 클릭 시 toggleMute 가 호출된다", async () => {
    sessionState.status = "connected";
    renderAt("/call/abc", { partnerId: 2 });
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "음소거" }));

    expect(sessionState.toggleMute).toHaveBeenCalledOnce();
  });

  it("isMuted=true 면 mute 버튼이 활성 시각 클래스 + aria-pressed=true + 슬래시 아이콘을 가진다", () => {
    sessionState.status = "connected";
    sessionState.isMuted = true;
    renderAt("/call/abc", { partnerId: 2 });

    const muteBtn = screen.getByRole("button", { name: "음소거" });
    expect(muteBtn.className).toMatch(/bg-gray-900/);
    expect(muteBtn.className).toMatch(/text-white/);
    expect(muteBtn.className).not.toMatch(/bg-white/);
    expect(muteBtn).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("mic-slash")).toBeInTheDocument();
  });

  it("isMuted=false 면 mute 버튼이 기본 시각 클래스 + aria-pressed=false + 슬래시 없음", () => {
    sessionState.status = "connected";
    sessionState.isMuted = false;
    renderAt("/call/abc", { partnerId: 2 });

    const muteBtn = screen.getByRole("button", { name: "음소거" });
    expect(muteBtn.className).toMatch(/bg-white/);
    expect(muteBtn.className).toMatch(/text-gray-800/);
    expect(muteBtn.className).not.toMatch(/bg-gray-900/);
    expect(muteBtn).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByTestId("mic-slash")).not.toBeInTheDocument();
  });

  it("end 버튼 클릭 → 시트 노출 → '종료하기' → session.end() 호출", async () => {
    sessionState.status = "connected";
    renderAt("/call/abc", { partnerId: 2 });
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "통화 종료" }));
    expect(
      screen.getByRole("dialog", { name: "통화를 종료할까요?" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "종료하기" }));

    expect(sessionState.end).toHaveBeenCalledOnce();
  });

  it("status='ended' 면 / 로 redirect 한다", async () => {
    sessionState.status = "ended";
    renderAt("/call/abc", { partnerId: 2 });

    await waitFor(() =>
      expect(screen.getByText("홈입니다")).toBeInTheDocument(),
    );
  });

  it("status='error' 면 errorMessage 와 '메인으로' 버튼을 보여준다", async () => {
    sessionState.status = "error";
    sessionState.errorMessage = "마이크 권한이 필요해요";
    renderAt("/call/abc", { partnerId: 2 });

    expect(screen.getByText("마이크 권한이 필요해요")).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "메인으로" }));

    await waitFor(() =>
      expect(screen.getByText("홈입니다")).toBeInTheDocument(),
    );
  });
});
