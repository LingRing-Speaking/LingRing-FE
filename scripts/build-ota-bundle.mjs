// dist/ 를 zip 으로 묶고 매니페스트 JSON 을 out/ 에 생성한다.
// OTA_S3_BUCKET 이 설정되면 S3 에 업로드한다 (정적 호스팅: S3 + CloudFront).
// 미설정 시 out/ 에만 생성하고 끝낸다 (serve:ota 로 로컬 검증).
//
// 환경 변수:
//   OTA_BUNDLE_BASE_URL             매니페스트의 zip URL 베이스 (CloudFront 도메인).
//                                   미설정 시 http://localhost:8888 (로컬 검증).
//   OTA_S3_BUCKET                   업로드 대상 버킷. 미설정 시 업로드 생략.
//   OTA_S3_PREFIX                   버킷 내 키 접두사 (선택, 예: "ota/").
//   OTA_CLOUDFRONT_DISTRIBUTION_ID  설정 시 manifest.json 캐시 무효화 (선택).
//
// 출력:
//   out/app-{version}.zip
//   out/manifest.json   { version, url, checksum }

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

const BUNDLE_BASE_URL =
  process.env.OTA_BUNDLE_BASE_URL ?? "http://localhost:8888";
const S3_BUCKET = process.env.OTA_S3_BUCKET;
const S3_PREFIX = process.env.OTA_S3_PREFIX ?? "";
const CLOUDFRONT_DISTRIBUTION_ID = process.env.OTA_CLOUDFRONT_DISTRIBUTION_ID;

if (!existsSync(DIST_DIR)) {
  console.error(
    "[build-ota-bundle] dist/ 가 없습니다. 먼저 `npm run build` 를 실행하세요.",
  );
  process.exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });

const pkg = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8"));

// 버전은 커밋 수로 단조 증가시킨다. 로컬 .build-counter 와 달리 CI 에서도
// 리셋되지 않고, 같은 커밋을 다시 빌드하면 같은 버전이 나와 불필요한 OTA 를 막는다.
const { stdout: commitCountRaw } = await execFileAsync(
  "git",
  ["rev-list", "--count", "HEAD"],
  { cwd: ROOT },
);
const commitCount = commitCountRaw.trim();
const baseVersion = pkg.version.split("-")[0];
const [major, minor] = baseVersion.split(".");
const version = `${major}.${minor}.${commitCount}`;
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
const manifestPath = resolve(OUT_DIR, "manifest.json");
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(
  `[build-ota-bundle] version=${version} size=${zipBytes.length}B sha256=${checksum.slice(0, 16)}…`,
);
console.log(`[build-ota-bundle] → out/${zipName}`);
console.log(`[build-ota-bundle] → out/manifest.json (url=${manifest.url})`);

if (!S3_BUCKET) {
  console.log(
    "[build-ota-bundle] OTA_S3_BUCKET 미설정 — S3 업로드 생략(로컬 전용).",
  );
  process.exit(0);
}

// zip 을 먼저 올리고 manifest 를 마지막에 올린다. manifest 가 가리키는 zip 이
// 항상 먼저 존재해야 클라이언트가 깨진 url 을 받지 않는다.
const zipKey = `${S3_PREFIX}${zipName}`;
const manifestKey = `${S3_PREFIX}manifest.json`;

await execFileAsync("aws", [
  "s3",
  "cp",
  zipPath,
  `s3://${S3_BUCKET}/${zipKey}`,
  "--content-type",
  "application/zip",
  // 파일명에 버전이 박혀 내용이 불변 → 장기 캐시
  "--cache-control",
  "public, max-age=31536000, immutable",
]);
console.log(`[build-ota-bundle] ↑ s3://${S3_BUCKET}/${zipKey}`);

await execFileAsync("aws", [
  "s3",
  "cp",
  manifestPath,
  `s3://${S3_BUCKET}/${manifestKey}`,
  "--content-type",
  "application/json",
  // 항상 최신을 받아야 하므로 캐시 금지
  "--cache-control",
  "no-cache, max-age=0, must-revalidate",
]);
console.log(`[build-ota-bundle] ↑ s3://${S3_BUCKET}/${manifestKey}`);

if (CLOUDFRONT_DISTRIBUTION_ID) {
  await execFileAsync("aws", [
    "cloudfront",
    "create-invalidation",
    "--distribution-id",
    CLOUDFRONT_DISTRIBUTION_ID,
    "--paths",
    `/${manifestKey}`,
  ]);
  console.log(`[build-ota-bundle] CloudFront invalidation 요청: /${manifestKey}`);
}

console.log("[build-ota-bundle] 업로드 완료.");
