import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import path from "node:path";
import { computeAppVersion } from "./scripts/app-version.mjs";

// Sentry release — OTA 번들 버전(major.minor.커밋수)과 동일한 계산을 공유한다.
// git 이 없는 환경에서는 release 없이 초기화되도록 undefined 로 둔다.
function resolveSentryRelease(): string | undefined {
  if (process.env.VITE_SENTRY_RELEASE) return process.env.VITE_SENTRY_RELEASE;
  try {
    return computeAppVersion();
  } catch {
    return undefined;
  }
}

export default defineConfig(({ mode }) => {
  // SENTRY_AUTH_TOKEN 은 VITE_ 접두사가 없어 .env 에서 process.env 로 자동 유입되지
  // 않는다 — loadEnv 로 직접 읽고, 셸/CI 에서 준 값이 있으면 그쪽을 우선한다.
  const fileEnv = loadEnv(mode, process.cwd(), "SENTRY_");
  const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN ?? fileEnv.SENTRY_AUTH_TOKEN;
  const uploadSourcemaps = Boolean(sentryAuthToken) && mode !== "test";
  const sentryRelease = resolveSentryRelease();

  return {
    plugins: [
      react(),
      // 소스맵 업로드는 토큰이 있을 때만 활성화 — 없으면 업로드만 생략되고 빌드는 정상.
      ...(uploadSourcemaps
        ? [
            sentryVitePlugin({
              org: process.env.SENTRY_ORG ?? fileEnv.SENTRY_ORG,
              project: process.env.SENTRY_PROJECT ?? fileEnv.SENTRY_PROJECT,
              authToken: sentryAuthToken,
              ...(sentryRelease ? { release: { name: sentryRelease } } : {}),
              telemetry: false,
              // 업로드 뒤 배포물에서 소스맵을 지운다 — 원본 소스 노출 방지.
              sourcemaps: { filesToDeleteAfterUpload: ["./dist/**/*.map"] },
            }),
          ]
        : []),
    ],
    // test 모드에서는 정적 치환을 빼서 vi.stubEnv 로 값을 제어할 수 있게 한다.
    define:
      mode === "test"
        ? undefined
        : {
            "import.meta.env.VITE_SENTRY_RELEASE": JSON.stringify(sentryRelease ?? null),
          },
    build: {
      // hidden: 소스맵을 생성하되 번들에 참조 주석은 남기지 않는다.
      sourcemap: uploadSourcemaps ? ("hidden" as const) : false,
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    test: {
      globals: true,
      environment: "jsdom",
      setupFiles: ["./test/setup.ts"],
      css: false,
      exclude: [
        "**/node_modules/**",
        "**/dist/**",
        "**/.{idea,git,cache,output,temp}/**",
        "**/.claude/**",
      ],
      coverage: {
        provider: "v8",
        reporter: ["text", "html"],
        include: ["src/**/*.{ts,tsx}"],
        exclude: [
          "src/main.tsx",
          "src/App.tsx",
          "src/providers/QueryProvider.tsx",
          "src/vite-env.d.ts",
          "**/*.d.ts",
          "**/*.test.{ts,tsx}",
        ],
        thresholds: {
          lines: 80,
          functions: 80,
          branches: 80,
          statements: 80,
        },
      },
    },
  };
});
