import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@sentry/capacitor", () => ({
  init: vi.fn(),
  setUser: vi.fn(),
}));
vi.mock("@sentry/react", () => ({
  init: vi.fn(),
}));

import * as Sentry from "@sentry/capacitor";
import * as SentryReact from "@sentry/react";
import { initSentry, setSentryUser } from "./sentry";

const TEST_DSN = "https://key@o123.ingest.sentry.io/456";

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

// DSN·environment 는 채널 빌드에서만 주입된다 — 로컬 웹 개발·QA 빌드는 둘 중
// 하나가 비어 Sentry 를 태우지 않는 것이 기본 동작이어야 한다.
describe("initSentry — env 미설정이면 건너뛴다", () => {
  it("DSN 이 없으면 초기화하지 않고 경고만 남긴다", () => {
    // .env 의 실제 DSN 이 테스트 env 로 로드될 수 있어 명시적으로 비운다.
    vi.stubEnv("VITE_SENTRY_DSN", "");
    vi.stubEnv("VITE_SENTRY_ENVIRONMENT", "dev");

    initSentry();

    expect(Sentry.init).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledOnce();
  });

  it("environment 가 없으면 초기화하지 않고 경고만 남긴다", () => {
    vi.stubEnv("VITE_SENTRY_DSN", TEST_DSN);
    vi.stubEnv("VITE_SENTRY_ENVIRONMENT", "");

    initSentry();

    expect(Sentry.init).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledOnce();
  });
});

describe("initSentry — env 설정됨", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_SENTRY_DSN", TEST_DSN);
    vi.stubEnv("VITE_SENTRY_ENVIRONMENT", "dev");
    vi.stubEnv("VITE_SENTRY_RELEASE", "1.2.345");
  });

  it("DSN·environment·release 를 전달해 React 브릿지와 함께 초기화한다", () => {
    initSentry();

    expect(Sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: TEST_DSN,
        environment: "dev",
        release: "1.2.345",
      }),
      SentryReact.init,
    );
  });

  it("성능 트레이싱을 끄고 기본 PII 수집을 막는다", () => {
    initSentry();

    expect(Sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({
        tracesSampleRate: 0,
        sendDefaultPii: false,
      }),
      expect.anything(),
    );
  });

  it("init 이 던져도 앱을 죽이지 않고 경고만 남긴다", () => {
    vi.mocked(Sentry.init).mockImplementation(() => {
      throw new Error("native bridge unavailable");
    });

    expect(() => initSentry()).not.toThrow();
    expect(console.warn).toHaveBeenCalledOnce();
  });
});

describe("setSentryUser", () => {
  it("userId 를 문자열 id 로 설정한다", () => {
    setSentryUser(42);

    expect(Sentry.setUser).toHaveBeenCalledWith({ id: "42" });
  });

  it("null 이면 사용자 컨텍스트를 지운다", () => {
    setSentryUser(null);

    expect(Sentry.setUser).toHaveBeenCalledWith(null);
  });
});
