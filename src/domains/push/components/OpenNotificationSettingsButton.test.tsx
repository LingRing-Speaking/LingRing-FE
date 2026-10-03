import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getNotificationSettingsOpener,
  openAndroidNotificationSettings,
} from "../notificationSettings";
import { OpenNotificationSettingsButton } from "./OpenNotificationSettingsButton";

vi.mock("../notificationSettings", () => ({
  getIosAppSettingsUrl: () => "app-settings:notifications",
  getNotificationSettingsOpener: vi.fn(),
  openAndroidNotificationSettings: vi.fn(),
}));

describe("OpenNotificationSettingsButton", () => {
  beforeEach(() => {
    vi.mocked(getNotificationSettingsOpener).mockReset();
    vi.mocked(openAndroidNotificationSettings).mockReset().mockResolvedValue(undefined);
  });

  it("iOS 에서는 앱 설정 링크를 보여준다", () => {
    vi.mocked(getNotificationSettingsOpener).mockReturnValue("ios-link");
    render(<OpenNotificationSettingsButton />);

    expect(screen.getByRole("link", { name: "설정 열기" })).toHaveAttribute(
      "href",
      "app-settings:notifications",
    );
  });

  it("Android 에서는 누르면 네이티브로 앱 알림 설정을 연다", async () => {
    vi.mocked(getNotificationSettingsOpener).mockReturnValue("android-plugin");
    const user = userEvent.setup();
    render(<OpenNotificationSettingsButton />);

    await user.click(screen.getByRole("button", { name: "설정 열기" }));

    expect(openAndroidNotificationSettings).toHaveBeenCalledOnce();
  });

  it("열 수 없는 환경에서는 아무것도 보여주지 않는다", () => {
    vi.mocked(getNotificationSettingsOpener).mockReturnValue(null);
    const { container } = render(<OpenNotificationSettingsButton />);

    expect(container).toBeEmptyDOMElement();
  });
});
