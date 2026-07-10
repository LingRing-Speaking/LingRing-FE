import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: vi.fn() },
}));
vi.mock("./webrtcPlugin", () => ({
  NativeWebRTC: {
    configureForCall: vi.fn().mockResolvedValue(undefined),
    setSpeaker: vi.fn().mockResolvedValue(undefined),
    endCall: vi.fn().mockResolvedValue(undefined),
  },
}));

import { Capacitor } from "@capacitor/core";
import { NativeWebRTC } from "@/lib/native/webrtcPlugin";
import {
  configureCallAudioRoute,
  endCallAudioRoute,
  setSpeakerphone,
} from "./audioRoute";

beforeEach(() => {
  vi.clearAllMocks();
});

// #193 Phase 2: iOS/Android 모두 같은 WebRTC 플러그인을 구현하므로
// audioRoute 는 "네이티브면 호출, 웹이면 no-op" 하나의 분기만 갖는다.
describe("audioRoute — 네이티브 (iOS/Android 공통)", () => {
  beforeEach(() => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
  });

  it("configureCallAudioRoute 는 NativeWebRTC.configureForCall 을 호출한다", async () => {
    await configureCallAudioRoute();
    expect(NativeWebRTC.configureForCall).toHaveBeenCalledTimes(1);
  });

  it("setSpeakerphone 은 NativeWebRTC.setSpeaker 에 on 값을 전달한다", async () => {
    await setSpeakerphone(true);
    expect(NativeWebRTC.setSpeaker).toHaveBeenCalledWith({ on: true });

    await setSpeakerphone(false);
    expect(NativeWebRTC.setSpeaker).toHaveBeenCalledWith({ on: false });
  });

  it("endCallAudioRoute 는 NativeWebRTC.endCall 을 호출한다", async () => {
    await endCallAudioRoute();
    expect(NativeWebRTC.endCall).toHaveBeenCalledTimes(1);
  });
});

describe("audioRoute — 웹(dev)", () => {
  beforeEach(() => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
  });

  it("모든 함수가 no-op 이다", async () => {
    await configureCallAudioRoute();
    await setSpeakerphone(true);
    await endCallAudioRoute();

    expect(NativeWebRTC.configureForCall).not.toHaveBeenCalled();
    expect(NativeWebRTC.setSpeaker).not.toHaveBeenCalled();
    expect(NativeWebRTC.endCall).not.toHaveBeenCalled();
  });
});
