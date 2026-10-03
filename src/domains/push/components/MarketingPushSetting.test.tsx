import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "@/mocks/server";
import { env } from "@/config/env";
import { useAuthStore } from "@/domains/auth/store";
import type { User } from "@/domains/auth/types";
import { enablePush, getPushPermission } from "../pushToken";
import { renderWithQueryClient } from "../../../../test/utils/renderWithQueryClient";
import { MarketingPushSetting } from "./MarketingPushSetting";

vi.mock("../pushToken", () => ({ enablePush: vi.fn(), getPushPermission: vi.fn() }));

const URL = `${env.apiBaseUrl}/api/v1/me/notification-settings`;
const DEVICE_SETTING_GUIDE = "기기 설정에서 LingRing 알림을 허용해야 받을 수 있어요.";
const BASE_USER: User = { id: 1, nickname: "tester", profileImage: null };
const AGREED_USER: User = {
  ...BASE_USER,
  marketingPushAgreed: true,
  marketingPushUpdatedAt: "2026-10-02T20:00:00",
};
const WITHDRAWN_USER: User = {
  ...BASE_USER,
  marketingPushAgreed: false,
  marketingPushUpdatedAt: "2026-11-05T09:30:00",
};
const NEVER_AGREED_USER: User = {
  ...BASE_USER,
  marketingPushAgreed: false,
  marketingPushUpdatedAt: null,
};

function getSwitch() {
  return screen.getByRole("switch", { name: "알림 받기" });
}

function respondWithUser(user: User, onBody?: (body: unknown) => void) {
  server.use(
    http.patch(URL, async ({ request }) => {
      onBody?.(await request.json());
      return HttpResponse.json({ data: { user }, status: 200, message: "OK" });
    }),
  );
}

function renderSetting(user: User) {
  return renderWithQueryClient(<MarketingPushSetting />, { user });
}

describe("MarketingPushSetting", () => {
  beforeEach(() => {
    vi.mocked(enablePush).mockReset().mockResolvedValue(true);
    vi.mocked(getPushPermission).mockReset().mockResolvedValue("granted");
  });

  it("'알림 받기' 토글과 광고성 정보 포함 안내를 보여준다", async () => {
    renderSetting(AGREED_USER);

    expect(getSwitch()).toBeInTheDocument();
    expect(await screen.findByText(/광고성 정보 포함/)).toBeInTheDocument();
  });

  describe("표시 상태", () => {
    it("동의했고 기기 권한도 있으면 켜진 상태와 동의 처리 일자를 본다", async () => {
      renderSetting(AGREED_USER);

      await waitFor(() => expect(getSwitch()).toHaveAttribute("aria-checked", "true"));
      expect(screen.getByText(/2026\.10\.02 수신 동의/)).toBeInTheDocument();
    });

    it("철회한 유저는 꺼진 상태와 거부 처리 일자를 본다", async () => {
      renderSetting(WITHDRAWN_USER);

      expect(await screen.findByText(/2026\.11\.05 수신 거부/)).toBeInTheDocument();
      expect(getSwitch()).toHaveAttribute("aria-checked", "false");
    });

    it("한 번도 동의한 적 없는 유저는 꺼진 상태이고 처리 일자가 없다", async () => {
      renderSetting(NEVER_AGREED_USER);

      await waitFor(() => expect(getPushPermission).toHaveBeenCalled());
      expect(getSwitch()).toHaveAttribute("aria-checked", "false");
      expect(screen.queryByText(/수신 (동의|거부)/)).not.toBeInTheDocument();
    });

    // 재설치·기기 변경: 서버 동의는 남아 있지만 이 기기에서는 권한을 아직 묻지 않았다.
    it("동의했지만 기기 권한을 아직 묻지 않았으면 꺼진 상태로 보이고, 처리 일자·기기 안내는 없다", async () => {
      vi.mocked(getPushPermission).mockResolvedValue("prompt");
      renderSetting(AGREED_USER);

      await waitFor(() => expect(getPushPermission).toHaveBeenCalled());
      expect(getSwitch()).toHaveAttribute("aria-checked", "false");
      expect(screen.queryByText(/수신 동의/)).not.toBeInTheDocument();
      expect(screen.queryByText(DEVICE_SETTING_GUIDE)).not.toBeInTheDocument();
    });

    it("동의했지만 기기에서 알림이 꺼져 있으면 꺼진 상태로 보이고 기기 설정 안내를 보여준다", async () => {
      vi.mocked(getPushPermission).mockResolvedValue("denied");
      renderSetting(AGREED_USER);

      expect(await screen.findByText(DEVICE_SETTING_GUIDE)).toBeInTheDocument();
      expect(getSwitch()).toHaveAttribute("aria-checked", "false");
      expect(screen.queryByText(/수신 동의/)).not.toBeInTheDocument();
    });
  });

  describe("켜기", () => {
    it("권한을 먼저 요청하고, 허용되면 동의를 저장해 켜진 상태가 된다", async () => {
      vi.mocked(getPushPermission).mockResolvedValue("prompt");
      let body: unknown = null;
      respondWithUser(AGREED_USER, (b) => (body = b));
      const user = userEvent.setup();
      renderSetting(NEVER_AGREED_USER);

      await user.click(getSwitch());

      await waitFor(() => expect(getSwitch()).toHaveAttribute("aria-checked", "true"));
      expect(enablePush).toHaveBeenCalledOnce();
      expect(body).toEqual({ marketingPush: true });
      expect(useAuthStore.getState().user?.marketingPushAgreed).toBe(true);
      expect(screen.getByText(/2026\.10\.02 수신 동의/)).toBeInTheDocument();
    });

    it("권한을 거절하면 동의를 저장하지 않고 꺼진 상태로 남으며 기기 설정 안내를 보여준다", async () => {
      vi.mocked(getPushPermission).mockResolvedValue("prompt");
      vi.mocked(enablePush).mockResolvedValue(false);
      let patched = false;
      respondWithUser(AGREED_USER, () => (patched = true));
      const user = userEvent.setup();
      renderSetting(NEVER_AGREED_USER);

      await user.click(getSwitch());

      expect(await screen.findByText(DEVICE_SETTING_GUIDE)).toBeInTheDocument();
      expect(getSwitch()).toHaveAttribute("aria-checked", "false");
      expect(patched).toBe(false);
    });

    it("이미 동의한 유저(재설치)는 권한만 받으면 켜지고 동의를 다시 저장하지 않는다", async () => {
      vi.mocked(getPushPermission).mockResolvedValue("prompt");
      let patched = false;
      respondWithUser(AGREED_USER, () => (patched = true));
      const user = userEvent.setup();
      renderSetting(AGREED_USER);

      await user.click(getSwitch());

      await waitFor(() => expect(getSwitch()).toHaveAttribute("aria-checked", "true"));
      expect(enablePush).toHaveBeenCalledOnce();
      expect(patched).toBe(false);
    });

    it("동의 저장에 실패하면 꺼진 상태로 남고 오류 문구를 보여준다", async () => {
      server.use(
        http.patch(URL, () =>
          HttpResponse.json({ data: null, status: 500, message: "INTERNAL" }, { status: 500 }),
        ),
      );
      const user = userEvent.setup();
      renderSetting(NEVER_AGREED_USER);

      await user.click(getSwitch());

      await waitFor(() =>
        expect(screen.getByRole("alert")).toHaveTextContent("잠시 후 다시 시도해주세요."),
      );
      expect(getSwitch()).toHaveAttribute("aria-checked", "false");
    });
  });

  describe("끄기", () => {
    it("철회만 저장하고 알림 권한은 건드리지 않는다", async () => {
      let body: unknown = null;
      respondWithUser(WITHDRAWN_USER, (b) => (body = b));
      const user = userEvent.setup();
      renderSetting(AGREED_USER);
      await waitFor(() => expect(getSwitch()).toHaveAttribute("aria-checked", "true"));

      await user.click(getSwitch());

      await waitFor(() => expect(screen.getByText(/2026\.11\.05 수신 거부/)).toBeInTheDocument());
      expect(body).toEqual({ marketingPush: false });
      expect(getSwitch()).toHaveAttribute("aria-checked", "false");
      expect(enablePush).not.toHaveBeenCalled();
    });
  });

  // 기기 설정에서 알림을 켜고 돌아온 경우 화면을 다시 들어오지 않아도 반영돼야 한다.
  it("앱이 포그라운드로 돌아오면 기기 권한을 다시 확인한다", async () => {
    vi.mocked(getPushPermission).mockResolvedValue("denied");
    renderSetting(AGREED_USER);
    await screen.findByText(DEVICE_SETTING_GUIDE);

    vi.mocked(getPushPermission).mockResolvedValue("granted");
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await waitFor(() => expect(getSwitch()).toHaveAttribute("aria-checked", "true"));
    expect(screen.queryByText(DEVICE_SETTING_GUIDE)).not.toBeInTheDocument();
  });
});
