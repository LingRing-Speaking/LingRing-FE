import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "@/domains/auth/store";
import type { EndReason } from "@/domains/call/hooks/useCallSession";
import { createTestQueryClient } from "../../../test/utils/renderWithQueryClient";
import { CallPage } from "./CallPage";

const sessionState = {
  status: "connecting" as "connecting" | "connected" | "ended" | "error",
  errorMessage: null as string | null,
  endReason: null as EndReason | null,
  isMuted: false,
  toggleMute: vi.fn(),
  isSpeakerOn: false,
  toggleSpeaker: vi.fn(),
  end: vi.fn(),
  remoteAudioRef: createRef<HTMLAudioElement>(),
};

type PartnerProfile = {
  id: number;
  nickname: string;
  profileImage: string | null;
  level: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  mannerTemperature: number;
};

const profileState: { data: PartnerProfile | null } = { data: null };

vi.mock("@/domains/call/hooks/useCallSession", () => ({
  useCallSession: () => sessionState,
}));

vi.mock("@/domains/user/hooks/useUserProfile", () => ({
  useUserProfile: () => ({ data: profileState.data }),
}));

beforeEach(() => {
  sessionState.status = "connecting";
  sessionState.errorMessage = null;
  sessionState.endReason = null;
  sessionState.isMuted = false;
  sessionState.toggleMute = vi.fn();
  sessionState.isSpeakerOn = false;
  sessionState.toggleSpeaker = vi.fn();
  sessionState.end = vi.fn();
  profileState.data = null;
  useAuthStore.setState({
    user: { id: 1, nickname: "tester", profileImage: null },
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
      <MemoryRouter initialEntries={[{ pathname: path, state: state ?? null }]}>
        <Routes>
          <Route path="/call/:roomId" element={<CallPage />} />
          <Route path="/home" element={<div>홈입니다</div>} />
          <Route path="/history" element={<div>기록 페이지</div>} />
          <Route path="/matching" element={<div>매칭 페이지</div>} />
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

  it("connecting 상태에서는 '연결 중…' 라벨을 보여준다", () => {
    sessionState.status = "connecting";
    renderAt("/call/abc", { partnerId: 2 });

    expect(screen.getByText("연결 중…")).toBeInTheDocument();
  });

  it("connected 상태에서는 '연결됨' 라벨을 보여준다", () => {
    sessionState.status = "connected";
    renderAt("/call/abc", { partnerId: 2 });

    expect(screen.getByText("연결됨")).toBeInTheDocument();
  });

  it("connected 상태에서는 타이머와 mute/speaker/end 버튼을 보여준다", () => {
    sessionState.status = "connected";
    renderAt("/call/abc", { partnerId: 2 });

    // 카운트다운 — 연결 직후 남은 시간은 상한(20분)
    expect(screen.getByText("20:00")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "음소거" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "스피커" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "통화 종료" })).toBeInTheDocument();
  });

  it("스피커 버튼 클릭 시 toggleSpeaker 가 호출된다", async () => {
    sessionState.status = "connected";
    renderAt("/call/abc", { partnerId: 2 });
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "스피커" }));

    expect(sessionState.toggleSpeaker).toHaveBeenCalledOnce();
  });

  it("isSpeakerOn=true 면 스피커 버튼이 활성 시각 클래스 + aria-pressed=true 를 가진다", () => {
    sessionState.status = "connected";
    sessionState.isSpeakerOn = true;
    renderAt("/call/abc", { partnerId: 2 });

    const speakerBtn = screen.getByRole("button", { name: "스피커" });
    expect(speakerBtn.className).toMatch(/bg-gray-900/);
    expect(speakerBtn.className).toMatch(/text-white/);
    expect(speakerBtn.className).not.toMatch(/bg-white/);
    expect(speakerBtn).toHaveAttribute("aria-pressed", "true");
  });

  it("isSpeakerOn=false 면 스피커 버튼이 기본 시각 클래스 + aria-pressed=false 를 가진다", () => {
    sessionState.status = "connected";
    sessionState.isSpeakerOn = false;
    renderAt("/call/abc", { partnerId: 2 });

    const speakerBtn = screen.getByRole("button", { name: "스피커" });
    expect(speakerBtn.className).toMatch(/bg-white/);
    expect(speakerBtn.className).toMatch(/text-gray-800/);
    expect(speakerBtn.className).not.toMatch(/bg-gray-900/);
    expect(speakerBtn).toHaveAttribute("aria-pressed", "false");
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
    expect(screen.getByRole("dialog", { name: "통화를 종료할까요?" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "종료하기" }));

    expect(sessionState.end).toHaveBeenCalledOnce();
  });

  it("status='ended' 면 종료 후 2갈래 선택 화면을 보여준다", () => {
    sessionState.status = "ended";
    sessionState.endReason = "timeout";
    renderAt("/call/abc", { partnerId: 2 });

    expect(
      screen.getByRole("button", { name: "통화 내용 분석하기" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "한 번 더 대화하기" }),
    ).toBeInTheDocument();
  });

  it("timeout 종료면 '수고했어요' 카피를 보여준다", () => {
    sessionState.status = "ended";
    sessionState.endReason = "timeout";
    renderAt("/call/abc", { partnerId: 2 });

    expect(screen.getByText(/수고했어요/)).toBeInTheDocument();
  });

  it("종료 화면에서 '통화 내용 분석하기' → /history 로 이동한다", async () => {
    sessionState.status = "ended";
    sessionState.endReason = "timeout";
    renderAt("/call/abc", { partnerId: 2 });
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "통화 내용 분석하기" }));

    expect(screen.getByText("기록 페이지")).toBeInTheDocument();
  });

  it("종료 화면에서 '한 번 더 대화하기' → /matching 으로 이동한다", async () => {
    sessionState.status = "ended";
    sessionState.endReason = "timeout";
    renderAt("/call/abc", { partnerId: 2 });
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "한 번 더 대화하기" }));

    expect(screen.getByText("매칭 페이지")).toBeInTheDocument();
  });

  it("status='error' 면 errorMessage 와 '메인으로' 버튼을 보여준다", async () => {
    sessionState.status = "error";
    sessionState.errorMessage = "마이크 권한이 필요해요";
    renderAt("/call/abc", { partnerId: 2 });

    expect(screen.getByText("마이크 권한이 필요해요")).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "메인으로" }));

    await waitFor(() => expect(screen.getByText("홈입니다")).toBeInTheDocument());
  });

  it("profileImage 가 있으면 상대 프로필 이미지를 렌더한다", () => {
    sessionState.status = "connected";
    profileState.data = {
      id: 2,
      nickname: "에이미",
      profileImage: "https://cdn.example.com/p/2.jpg",
      level: "BEGINNER",
      mannerTemperature: 36.5,
    };
    renderAt("/call/abc", { partnerId: 2 });

    const img = screen.getByAltText("상대 프로필 이미지") as HTMLImageElement;
    expect(img).toBeInTheDocument();
    expect(img.src).toBe("https://cdn.example.com/p/2.jpg");
  });

  it("profileImage 가 null 이고 nickname 이 있으면 닉네임 첫 글자를 보여준다", () => {
    sessionState.status = "connected";
    profileState.data = {
      id: 2,
      nickname: "에이미",
      profileImage: null,
      level: "BEGINNER",
      mannerTemperature: 36.5,
    };
    renderAt("/call/abc", { partnerId: 2 });

    expect(screen.queryByAltText("상대 프로필 이미지")).not.toBeInTheDocument();
    expect(screen.getByText("에")).toBeInTheDocument();
  });

  it("프로필이 로드되면 사진 밑에 닉네임을 표시한다 (partnerId fallback 대신)", () => {
    sessionState.status = "connected";
    profileState.data = {
      id: 42,
      nickname: "재크",
      profileImage: null,
      level: "INTERMEDIATE",
      mannerTemperature: 36.5,
    };
    renderAt("/call/abc", { partnerId: 42 });

    expect(screen.getByText("재크")).toBeInTheDocument();
    expect(screen.queryByText("상대 #42")).not.toBeInTheDocument();
  });

  it("프로필이 아직 없으면 사진 밑에 partnerId fallback 을 보여준다", () => {
    sessionState.status = "connected";
    profileState.data = null;
    renderAt("/call/abc", { partnerId: 42 });

    expect(screen.getByText("상대 #42")).toBeInTheDocument();
  });

  describe("상대방 프로필 모달", () => {
    it("프로필 영역(아바타·닉네임) 탭 시 PartnerProfileModal 이 열린다", async () => {
      sessionState.status = "connected";
      profileState.data = {
        id: 2,
        nickname: "에이미",
        profileImage: null,
        level: "BEGINNER",
        mannerTemperature: 36.5,
      };
      renderAt("/call/abc", { partnerId: 2 });
      const user = userEvent.setup();

      await user.click(screen.getByRole("button", { name: "상대방 정보 보기" }));

      const dialog = await screen.findByRole("dialog");
      expect(dialog).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "신고하기" })).toBeInTheDocument();
    });

    it("프로필 모달의 [신고하기] 클릭 → 신고 모달로 전환된다", async () => {
      sessionState.status = "connected";
      profileState.data = {
        id: 2,
        nickname: "에이미",
        profileImage: null,
        level: "BEGINNER",
        mannerTemperature: 36.5,
      };
      renderAt("/call/abc", { partnerId: 2 });
      const user = userEvent.setup();

      await user.click(screen.getByRole("button", { name: "상대방 정보 보기" }));
      await user.click(await screen.findByRole("button", { name: "신고하기" }));

      // ReportModal 의 사유 라디오 노출 = 신고 모달로 전환된 표지
      expect(await screen.findByRole("radio", { name: "부적절한 대화" })).toBeInTheDocument();
    });

    it("프로필 모달에 [차단하기] 와 [신고하기] 가 함께 노출된다", async () => {
      sessionState.status = "connected";
      profileState.data = {
        id: 2,
        nickname: "에이미",
        profileImage: null,
        level: "BEGINNER",
        mannerTemperature: 36.5,
      };
      renderAt("/call/abc", { partnerId: 2 });
      const user = userEvent.setup();

      await user.click(screen.getByRole("button", { name: "상대방 정보 보기" }));

      expect(await screen.findByRole("button", { name: "차단하기" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "신고하기" })).toBeInTheDocument();
    });

    it("프로필 모달의 [차단하기] 클릭 → 차단 확인 모달로 전환된다", async () => {
      sessionState.status = "connected";
      profileState.data = {
        id: 2,
        nickname: "에이미",
        profileImage: null,
        level: "BEGINNER",
        mannerTemperature: 36.5,
      };
      renderAt("/call/abc", { partnerId: 2 });
      const user = userEvent.setup();

      await user.click(screen.getByRole("button", { name: "상대방 정보 보기" }));
      await user.click(await screen.findByRole("button", { name: "차단하기" }));

      expect(await screen.findByText("이 사용자를 차단할까요?")).toBeInTheDocument();
    });
  });
});
