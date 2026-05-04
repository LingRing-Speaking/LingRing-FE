import { Capacitor, registerPlugin } from "@capacitor/core";

interface AudioRoutePlugin {
  setSpeaker(opts: { on: boolean }): Promise<void>;
}

const AudioRoute = registerPlugin<AudioRoutePlugin>("AudioRoute");

// 스피커 라우팅 토글. 웹/Android 환경에서는 무시 (no-op).
// iOS 네이티브에서만 AVAudioSession.overrideOutputAudioPort 호출.
export async function setSpeakerphone(on: boolean): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  if (Capacitor.getPlatform() !== "ios") return;
  await AudioRoute.setSpeaker({ on });
}
