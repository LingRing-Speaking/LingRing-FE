import { Capacitor, CapacitorHttp } from "@capacitor/core";
import { CapacitorUpdater } from "@capgo/capacitor-updater";
import { captureException } from "@/lib/sentry";

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
  // 다운로드/적용 실패는 배포 사고 신호 — 콘솔로만 남기지 않고 보고한다.
  await CapacitorUpdater.addListener("downloadFailed", (event) => {
    console.error(`${LOG_PREFIX} downloadFailed`, event);
    captureException(new Error(`${LOG_PREFIX} downloadFailed`), {
      tags: { source: "ota" },
      extra: { event },
    });
  });
  await CapacitorUpdater.addListener("updateFailed", (event) => {
    console.error(`${LOG_PREFIX} updateFailed`, event);
    captureException(new Error(`${LOG_PREFIX} updateFailed`), {
      tags: { source: "ota" },
      extra: { event },
    });
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

  let response;
  try {
    // WebView 의 fetch 는 capacitor://localhost 출처라 cross-origin 으로 CORS 에
    // 막힌다. CapacitorHttp 는 네이티브 HTTP 로 나가 CORS 제약을 받지 않는다.
    response = await CapacitorHttp.get({
      url: updateUrl,
      headers: { "Cache-Control": "no-cache" },
    });
  } catch (error) {
    // 오프라인/일시 네트워크 실패는 정상 케이스 — 다음 실행에서 재시도되므로 보고하지 않는다.
    console.warn(`${LOG_PREFIX} manifest 요청 실패`, error);
    return;
  }

  if (response.status < 200 || response.status >= 300) {
    // 정적 호스팅 manifest 의 응답 오류는 배포가 깨졌다는 신호다.
    console.error(`${LOG_PREFIX} manifest 응답 오류`, response.status);
    captureException(
      new Error(`${LOG_PREFIX} manifest 응답 오류 (status ${response.status})`),
      { tags: { source: "ota" } },
    );
    return;
  }

  const manifest = response.data as OtaManifest;
  try {
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
    // 여기 실패는 사용자가 구 번들에 갇힌다는 뜻 — 무신호로 두지 않는다.
    console.error(`${LOG_PREFIX} 업데이트 적용 실패`, error);
    captureException(error, {
      tags: { source: "ota" },
      extra: { manifestVersion: manifest.version },
    });
  }
}
