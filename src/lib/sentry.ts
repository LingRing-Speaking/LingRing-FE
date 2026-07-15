import { Capacitor } from "@capacitor/core";
import * as Sentry from "@sentry/capacitor";
import * as SentryReact from "@sentry/react";

const LOG_PREFIX = "[sentry]";

// DSN·environment 는 채널 빌드 스크립트(build:ios:dev 등)가 주입한다.
// 로컬 웹 개발·QA 빌드는 값이 비어 있어 초기화를 건너뛴다 — Sentry 없이 정상 동작.
export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  const environment = import.meta.env.VITE_SENTRY_ENVIRONMENT;
  if (!dsn || !environment) {
    console.warn(
      `${LOG_PREFIX} VITE_SENTRY_DSN 또는 VITE_SENTRY_ENVIRONMENT 미설정 — 초기화 건너뜀`,
    );
    return;
  }

  // 구 바이너리(스토어 구버전)에 OTA 로 새 JS 가 내려간 경우 네이티브 플러그인이
  // 없다 — 그대로 init 하면 네이티브 브릿지가 throw 하므로 JS 전용 모드로 강등한다.
  const nativeAvailable = Capacitor.isPluginAvailable("SentryCapacitor");
  if (!nativeAvailable) {
    console.warn(`${LOG_PREFIX} 네이티브 플러그인 없음(구 바이너리) — JS 전용 모드로 초기화`);
  }

  try {
    Sentry.init(
      {
        dsn,
        environment,
        enableNative: nativeAvailable,
        // 강등 시 SDK 자체 경고 로그 억제 — 위에서 우리 로그로 대신한다.
        enableNativeNagger: false,
        // vite define 이 git 없는 환경에서 null 을 넣을 수 있어 undefined 로 정규화.
        release: import.meta.env.VITE_SENTRY_RELEASE ?? undefined,
        // 도입 목적은 에러 추적 — 성능 트레이싱은 끄고 무료 쿼터를 아낀다.
        tracesSampleRate: 0,
        // email·name 등 기본 PII 수집 금지. 사용자 식별은 setSentryUser(서버 발급 id)로만.
        sendDefaultPii: false,
      },
      // Capacitor SDK 가 네이티브 레이어를, 두 번째 인자의 sibling SDK 가 JS 레이어를 초기화한다.
      SentryReact.init,
    );
  } catch (error) {
    // 모니터링 도구가 앱을 죽이는 일은 없어야 한다.
    console.warn(`${LOG_PREFIX} 초기화 실패 — 모니터링 없이 계속합니다`, error);
  }
}

// catch 로 잡아 UI 처리한 에러는 Sentry 자동 수집(unhandled)에 걸리지 않는다.
// "예상 밖 실패"를 삼키는 지점에서는 이 함수로 명시적으로 보고한다.
// 미초기화(로컬 QA 빌드) 상태에서는 SDK 가 no-op 이라 안전하다.
export function captureException(
  error: unknown,
  context?: {
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
  },
): void {
  Sentry.captureException(error, context);
}

export function setSentryUser(userId: number | null): void {
  Sentry.setUser(userId === null ? null : { id: String(userId) });
}
