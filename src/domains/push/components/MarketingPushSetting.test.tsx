import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "@/mocks/server";
import { env } from "@/config/env";
import { useAuthStore } from "@/domains/auth/store";
import type { User } from "@/domains/auth/types";
import { enablePush, isPushBlocked } from "../pushToken";
import { renderWithQueryClient } from "../../../../test/utils/renderWithQueryClient";
import { MarketingPushSetting } from "./MarketingPushSetting";

vi.mock("../pushToken", () => ({ enablePush: vi.fn(), isPushBlocked: vi.fn() }));

const URL = `${env.apiBaseUrl}/api/v1/me/notification-settings`;
const BASE_USER: User = { id: 1, nickname: "tester", profileImage: null };
const AGREED_USER: User = {
  ...BASE_USER,
  marketingPushAgreed: true,
  marketingPushUpdatedAt: "2026-10-02T20:00:00",
};
const NEVER_AGREED_USER: User = {
  ...BASE_USER,
  marketingPushAgreed: false,
  marketingPushUpdatedAt: null,
};

function getSwitch() {
  return screen.getByRole("switch", { name: "광고성 알림 수신" });
}

function respondWithUser(user: User, onBody?: (body: unknown) => void) {
  server.use(
    http.patch(URL, async ({ request }) => {
      onBody?.(await request.json());
      return HttpResponse.json({ data: { user }, status: 200, message: "OK" });
    }),
  );
}

describe("MarketingPushSetting", () => {
  beforeEach(() => {
    vi.mocked(enablePush).mockReset().mockResolvedValue(true);
    vi.mocked(isPushBlocked).mockReset().mockResolvedValue(false);
  });

  it("동의한 유저는 켜진 상태와 동의 처리 일자를 본다", () => {
    renderWithQueryClient(<MarketingPushSetting />, { user: AGREED_USER });

    expect(getSwitch()).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("2026.10.02 수신 동의")).toBeInTheDocument();
  });

  it("철회한 유저는 꺼진 상태와 거부 처리 일자를 본다", () => {
    renderWithQueryClient(<MarketingPushSetting />, {
      user: {
        ...BASE_USER,
        marketingPushAgreed: false,
        marketingPushUpdatedAt: "2026-11-05T09:30:00",
      },
    });

    expect(getSwitch()).toHaveAttribute("aria-checked", "false");
    expect(screen.getByText("2026.11.05 수신 거부")).toBeInTheDocument();
  });

  it("한 번도 동의한 적 없는 유저는 꺼진 상태이고 처리 일자가 없다", () => {
    renderWithQueryClient(<MarketingPushSetting />, { user: NEVER_AGREED_USER });

    expect(getSwitch()).toHaveAttribute("aria-checked", "false");
    expect(screen.queryByText(/수신 (동의|거부)$/)).not.toBeInTheDocument();
  });

  it("켜면 동의를 저장하고, 저장 후 알림 권한을 요청한다", async () => {
    let body: unknown = null;
    respondWithUser(AGREED_USER, (b) => (body = b));
    const user = userEvent.setup();
    renderWithQueryClient(<MarketingPushSetting />, { user: NEVER_AGREED_USER });

    await user.click(getSwitch());

    await waitFor(() => expect(enablePush).toHaveBeenCalledOnce());
    expect(body).toEqual({ marketingPush: true });
    expect(useAuthStore.getState().user?.marketingPushAgreed).toBe(true);
    expect(screen.getByText("2026.10.02 수신 동의")).toBeInTheDocument();
  });

  it("끄면 철회만 저장하고 알림 권한은 건드리지 않는다", async () => {
    let body: unknown = null;
    respondWithUser(
      { ...BASE_USER, marketingPushAgreed: false, marketingPushUpdatedAt: "2026-11-05T09:30:00" },
      (b) => (body = b),
    );
    const user = userEvent.setup();
    renderWithQueryClient(<MarketingPushSetting />, { user: AGREED_USER });

    await user.click(getSwitch());

    await waitFor(() => expect(screen.getByText("2026.11.05 수신 거부")).toBeInTheDocument());
    expect(body).toEqual({ marketingPush: false });
    expect(getSwitch()).toHaveAttribute("aria-checked", "false");
    expect(enablePush).not.toHaveBeenCalled();
  });

  it("저장에 실패하면 원래 상태로 돌아가고 오류 문구를 보여준다", async () => {
    server.use(
      http.patch(URL, () =>
        HttpResponse.json({ data: null, status: 500, message: "INTERNAL" }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    renderWithQueryClient(<MarketingPushSetting />, { user: NEVER_AGREED_USER });

    await user.click(getSwitch());

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("잠시 후 다시 시도해주세요."),
    );
    expect(getSwitch()).toHaveAttribute("aria-checked", "false");
    expect(enablePush).not.toHaveBeenCalled();
  });

  it("동의했지만 기기에서 알림이 꺼져 있으면 기기 설정 안내를 보여준다", async () => {
    vi.mocked(isPushBlocked).mockResolvedValue(true);
    renderWithQueryClient(<MarketingPushSetting />, { user: AGREED_USER });

    expect(
      await screen.findByText("기기 설정에서 LingRing 알림을 허용해야 받을 수 있어요."),
    ).toBeInTheDocument();
  });

  it("켰는데 알림 권한이 거부되면 기기 설정 안내를 보여준다", async () => {
    respondWithUser(AGREED_USER);
    vi.mocked(enablePush).mockResolvedValue(false);
    vi.mocked(isPushBlocked).mockResolvedValueOnce(false).mockResolvedValue(true);
    const user = userEvent.setup();
    renderWithQueryClient(<MarketingPushSetting />, { user: NEVER_AGREED_USER });

    await user.click(getSwitch());

    expect(
      await screen.findByText("기기 설정에서 LingRing 알림을 허용해야 받을 수 있어요."),
    ).toBeInTheDocument();
  });

  it("동의하지 않은 유저에게는 기기 설정 안내를 보여주지 않는다", async () => {
    vi.mocked(isPushBlocked).mockResolvedValue(true);
    renderWithQueryClient(<MarketingPushSetting />, { user: NEVER_AGREED_USER });

    await waitFor(() => expect(isPushBlocked).toHaveBeenCalled());
    expect(screen.queryByText(/기기 설정에서/)).not.toBeInTheDocument();
  });
});
