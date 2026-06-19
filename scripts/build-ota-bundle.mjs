// dist/ 를 zip 으로 묶고 매니페스트 JSON 을 out/ 에 생성한다.
// 1단계 로컬 검증용 — 2단계에서 S3 업로드 흐름으로 교체될 예정.
//
// 출력:
//   out/app-{version}.zip
//   out/manifest.json   { version, url, checksum }
//   out/.build-counter  (다음 빌드의 카운터 증가용)

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIST_DIR = resolve(ROOT, "dist");
const OUT_DIR = resolve(ROOT, "out");
const COUNTER_FILE = resolve(OUT_DIR, ".build-counter");

const BUNDLE_BASE_URL =
  process.env.OTA_BUNDLE_BASE_URL ?? "http://localhost:8888";

if (!existsSync(DIST_DIR)) {
  console.error(
    "[build-ota-bundle] dist/ 가 없습니다. 먼저 `npm run build` 를 실행하세요.",
  );
  process.exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });

const pkg = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8"));
const previousCounter = existsSync(COUNTER_FILE)
  ? Number(readFileSync(COUNTER_FILE, "utf8").trim())
  : 0;
const counter = previousCounter + 1;

// package.json version 의 patch 자리에 counter 를 더해 매번 더 높은 버전을 만든다.
// Capgo 플러그인은 서버 응답 version 이 현재보다 높을 때만 다운로드를 받는다.
const baseVersion = pkg.version.split("-")[0];
const [major, minor, patch] = baseVersion.split(".").map(Number);
const version = `${major}.${minor}.${patch + counter}`;
const zipName = `app-${version}.zip`;
const zipPath = resolve(OUT_DIR, zipName);

if (existsSync(zipPath)) rmSync(zipPath);
await execFileAsync("zip", ["-r", "-q", zipPath, "."], { cwd: DIST_DIR });

const zipBytes = readFileSync(zipPath);
const checksum = createHash("sha256").update(zipBytes).digest("hex");

const manifest = {
  version,
  url: `${BUNDLE_BASE_URL}/${zipName}`,
  checksum,
};
writeFileSync(
  resolve(OUT_DIR, "manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
writeFileSync(COUNTER_FILE, String(counter));

console.log(
  `[build-ota-bundle] version=${version} size=${zipBytes.length}B sha256=${checksum.slice(0, 16)}…`,
);
console.log(`[build-ota-bundle] → out/${zipName}`);
console.log(`[build-ota-bundle] → out/manifest.json (url=${manifest.url})`);
