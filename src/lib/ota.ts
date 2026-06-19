import { Capacitor, CapacitorHttp } from "@capacitor/core";
import { CapacitorUpdater } from "@capgo/capacitor-updater";

const LOG_PREFIX = "[ota]";

export async function initializeOtaUpdater(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  // notifyAppReady 가 10초 안에 호출되지 않으면 플러그인이 번들이 깨졌다고 판단해
  // 자동 롤백한다. 네트워크 요청·무거운 초기화 전에 가장 먼저 호출되어야 한다.
  await CapacitorUpdater.notifyAppReady();

  await registerDiagnosticListeners();

  // 업데이트 확인·다운로드는 앱 렌더를 막지 않도록 백그라운드로 진행한다.
  void checkForUpdate();
}

async function registerDiagnosticListeners(): Promise<void> {
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

interface OtaManifest {
  version: string;
  url: string;
  checksum?: string;
}

// 정적 호스팅(S3+CloudFront)에 올라간 manifest.json 을 직접 GET 해서 최신 버전을
// 판별한다. Capgo 의 auto-update(getLatest)는 updateUrl 로 POST 하므로 정적
// 오브젝트로는 응답할 수 없어 manual 모드로 직접 구현한다.
export async function checkForUpdate(): Promise<void> {
  const updateUrl = import.meta.env.VITE_OTA_UPDATE_URL;
  if (!updateUrl) {
    console.warn(`${LOG_PREFIX} VITE_OTA_UPDATE_URL 미설정 — 업데이트 확인 건너뜀`);
    return;
  }

  try {
    // WebView 의 fetch 는 capacitor://localhost 출처라 cross-origin 으로 CORS 에
    // 막힌다. CapacitorHttp 는 네이티브 HTTP 로 나가 CORS 제약을 받지 않는다.
    const response = await CapacitorHttp.get({
      url: updateUrl,
      headers: { "Cache-Control": "no-cache" },
    });
    if (response.status < 200 || response.status >= 300) {
      console.error(`${LOG_PREFIX} manifest 응답 오류`, response.status);
      return;
    }

    const manifest = response.data as OtaManifest;
    const { bundle } = await CapacitorUpdater.current();
    if (manifest.version === bundle.version) return; // 이미 최신

    const downloaded = await CapacitorUpdater.download({
      version: manifest.version,
      url: manifest.url,
      checksum: manifest.checksum,
    });

    // next 는 현재 세션을 끊지 않고 다음 백그라운드/재실행 때 새 번들을 적용한다.
    await CapacitorUpdater.next(downloaded);
  } catch (error) {
    console.error(`${LOG_PREFIX} 업데이트 확인 실패`, error);
  }
}
