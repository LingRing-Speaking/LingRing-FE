import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/sentry", () => ({
  setSentryUser: vi.fn(),
}));

import { setSentryUser } from "@/lib/sentry";
import { startSentryUserSync } from "./sentryUserSync";
import { useAuthStore, type Session } from "./store";

const TEST_SESSION: Session = {
  user: { id: 42, nickname: "테스트유저", profileImage: null },
  accessToken: "access-token",
  refreshToken: "refresh-token",
};

let stopSync: (() => void) | null = null;

beforeEach(() => {
  // 구독 시작 전에 스토어를 초기 상태로 되돌린다 — 테스트 간 세션 오염 방지.
  useAuthStore.getState().clearSession();
  vi.clearAllMocks();
});

afterEach(() => {
  stopSync?.();
  stopSync = null;
});

// 로그인·세션 복원·로그아웃·탈퇴·401 무효화 — 모든 세션 변화는 useAuthStore 를
// 지나므로, store 구독 한 곳이 Sentry user 동기화의 단일 지점이 된다.
describe("startSentryUserSync", () => {
  it("로그인(setSession) 시 서버 발급 userId 를 Sentry 에 설정한다", () => {
    stopSync = startSentryUserSync();

    useAuthStore.getState().setSession(TEST_SESSION);

    expect(setSentryUser).toHaveBeenCalledWith(42);
  });

  it("로그아웃(clearSession) 시 사용자 컨텍스트를 지운다", () => {
    stopSync = startSentryUserSync();
    useAuthStore.getState().setSession(TEST_SESSION);

    useAuthStore.getState().clearSession();

    expect(setSentryUser).toHaveBeenLastCalledWith(null);
  });

  it("userId 가 바뀌지 않는 상태 변화(토큰 갱신)에는 호출하지 않는다", () => {
    stopSync = startSentryUserSync();
    useAuthStore.getState().setSession(TEST_SESSION);
    vi.mocked(setSentryUser).mockClear();

    useAuthStore.getState().updateTokens({
      accessToken: "rotated-access",
      refreshToken: "rotated-refresh",
    });

    expect(setSentryUser).not.toHaveBeenCalled();
  });
});
