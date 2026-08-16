import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockAddListener } = vi.hoisted(() => ({ mockAddListener: vi.fn() }));
const { mockRecoveryRun } = vi.hoisted(() => ({ mockRecoveryRun: vi.fn() }));

vi.mock("@capacitor/app", () => ({ App: { addListener: mockAddListener } }));
vi.mock("./recordingRecovery", () => ({ recoveryRun: mockRecoveryRun }));

import { useAuthStore } from "@/domains/auth/store";
import { useRecordingRecovery } from "./useRecordingRecovery";

let appStateCallback: ((state: { isActive: boolean }) => void) | undefined;
const removeSpy = vi.fn();

function setAuthenticated(value: boolean) {
  useAuthStore.setState({ isAuthenticated: value });
}

describe("useRecordingRecovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRecoveryRun.mockResolvedValue(undefined);
    appStateCallback = undefined;
    mockAddListener.mockImplementation(
      (_event: string, cb: (s: { isActive: boolean }) => void) => {
        appStateCallback = cb;
        return Promise.resolve({ remove: removeSpy });
      },
    );
  });

  afterEach(() => {
    setAuthenticated(false);
  });

  // App mount 시점에 돌리면 세션 복원이 토큰을 넣기 전이라 401 을 받는다.
  it("인증 전에는 recovery 를 돌리지 않는다", () => {
    setAuthenticated(false);

    renderHook(() => useRecordingRecovery());

    expect(mockRecoveryRun).not.toHaveBeenCalled();
  });

  it("인증이 확립되면 recovery 를 돌린다", () => {
    setAuthenticated(true);

    renderHook(() => useRecordingRecovery());

    expect(mockRecoveryRun).toHaveBeenCalledTimes(1);
  });

  it("인증 전에 마운트됐어도 인증이 확립되면 그때 돌린다", () => {
    setAuthenticated(false);
    renderHook(() => useRecordingRecovery());

    act(() => setAuthenticated(true));

    expect(mockRecoveryRun).toHaveBeenCalledTimes(1);
  });

  // iOS 는 앱을 서스펜드로 오래 살려두므로 다시 열어도 App 이 remount 되지 않는다.
  it("포그라운드로 복귀하면 다시 돌린다", async () => {
    setAuthenticated(true);
    renderHook(() => useRecordingRecovery());
    await act(async () => {});

    act(() => appStateCallback?.({ isActive: true }));

    expect(mockRecoveryRun).toHaveBeenCalledTimes(2);
  });

  it("백그라운드로 갈 때는 돌리지 않는다", async () => {
    setAuthenticated(true);
    renderHook(() => useRecordingRecovery());
    await act(async () => {});

    act(() => appStateCallback?.({ isActive: false }));

    expect(mockRecoveryRun).toHaveBeenCalledTimes(1);
  });

  it("언마운트 시 리스너를 제거한다", async () => {
    setAuthenticated(true);
    const { unmount } = renderHook(() => useRecordingRecovery());
    await act(async () => {});

    unmount();

    expect(removeSpy).toHaveBeenCalled();
  });
});
