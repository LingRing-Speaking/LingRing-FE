import { Capacitor } from "@capacitor/core";
import { CapacitorUpdater } from "@capgo/capacitor-updater";

const LOG_PREFIX = "[ota]";

export async function initializeOtaUpdater(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  // notifyAppReady 가 10초 안에 호출되지 않으면 플러그인이 번들이 깨졌다고 판단해
  // 자동 롤백한다. 네트워크 요청·무거운 초기화 전에 가장 먼저 호출되어야 한다.
  await CapacitorUpdater.notifyAppReady();

  await CapacitorUpdater.addListener("updateAvailable", (event) => {
    console.log(`${LOG_PREFIX} updateAvailable`, event);
  });
  await CapacitorUpdater.addListener("downloadComplete", (event) => {
    console.log(`${LOG_PREFIX} downloadComplete`, event);
  });
  await CapacitorUpdater.addListener("downloadFailed", (event) => {
    console.error(`${LOG_PREFIX} downloadFailed`, event);
  });
  await CapacitorUpdater.addListener("updateFailed", (event) => {
    console.error(`${LOG_PREFIX} updateFailed`, event);
  });
  await CapacitorUpdater.addListener("appReloaded", () => {
    console.log(`${LOG_PREFIX} appReloaded`);
  });
}
