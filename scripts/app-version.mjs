// 앱 버전 문자열을 한 곳에서 계산한다 — OTA 번들(build-ota-bundle.mjs)과
// Sentry release(vite.config.ts)가 같은 값을 쓰기 위한 공통 헬퍼.
//
// 버전은 커밋 수로 단조 증가시킨다. 로컬 .build-counter 와 달리 CI 에서도
// 리셋되지 않고, 같은 커밋을 다시 빌드하면 같은 버전이 나와 불필요한 OTA 를 막는다.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function computeAppVersion() {
  const pkg = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8"));
  const commitCount = execFileSync("git", ["rev-list", "--count", "HEAD"], {
    cwd: ROOT,
    encoding: "utf8",
  }).trim();
  const baseVersion = pkg.version.split("-")[0];
  const [major, minor] = baseVersion.split(".");
  return `${major}.${minor}.${commitCount}`;
}
