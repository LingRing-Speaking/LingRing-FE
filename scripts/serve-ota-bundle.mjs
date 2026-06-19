// out/ 디렉토리를 정적 http 로 서빙한다 (manifest.json + app-*.zip).
// 1단계 로컬 검증용 — 외부 의존성 없이 Node built-in 만 사용한다.
//
// 사용:
//   npm run serve:ota          # http://localhost:8888
//   OTA_PORT=9000 npm run serve:ota

import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = resolve(ROOT, "out");
const PORT = Number(process.env.OTA_PORT ?? 8888);

if (!existsSync(OUT_DIR)) {
  console.error(
    "[serve-ota] out/ 가 없습니다. 먼저 `npm run bundle:ota` 를 실행하세요.",
  );
  process.exit(1);
}

const CONTENT_TYPES = {
  ".json": "application/json",
  ".zip": "application/zip",
};

const server = createServer((req, res) => {
  const pathname = decodeURIComponent(
    new URL(req.url ?? "/", `http://${req.headers.host}`).pathname,
  );
  const filePath = normalize(resolve(OUT_DIR, `.${pathname}`));
  if (!filePath.startsWith(OUT_DIR)) {
    res.writeHead(403).end("Forbidden");
    return;
  }
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    res.writeHead(404).end("Not Found");
    return;
  }
  res.writeHead(200, {
    "Content-Type":
      CONTENT_TYPES[extname(filePath)] ?? "application/octet-stream",
    "Cache-Control": "no-store",
  });
  res.end(readFileSync(filePath));
});

server.listen(PORT, () => {
  console.log(`[serve-ota] http://localhost:${PORT} → ${OUT_DIR}`);
});
