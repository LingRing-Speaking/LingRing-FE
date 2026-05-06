// `npx cap sync ios` 가 ios/App/CapApp-SPM/Package.swift 를 매번 wipe 하므로,
// 그 후처리로 stasel/WebRTC SPM 의존성을 idempotent 하게 재주입한다.
// Phase 0 검증 결과: cap CLI 가 third-party SPM dependency 를 자동 보존하지 않음.
// 참고 plan: /Users/spqje/.claude/plans/1-compressed-canyon.md (Phase 0.5)

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_SWIFT = resolve(__dirname, "../ios/App/CapApp-SPM/Package.swift");

const WEBRTC_PACKAGE_LINE =
  '        .package(url: "https://github.com/stasel/WebRTC.git", .upToNextMajor(from: "147.0.0"))';
const WEBRTC_PRODUCT_LINE =
  '                .product(name: "WebRTC", package: "WebRTC")';

const original = readFileSync(PACKAGE_SWIFT, "utf8");

if (original.includes('"https://github.com/stasel/WebRTC.git"')) {
  // 이미 주입됨 — no-op
  process.exit(0);
}

// 1) dependencies 배열의 마지막 .package(...) 항목 뒤에 stasel/WebRTC 라인 추가.
//    cap CLI 가 마지막 plugin package 를 trailing comma 없이 끝내므로 comma 도 같이 삽입.
const depsRegex = /(\.package\(name: "CapacitorKakaoLoginPlugin"[^\n]+)\n(\s+\],)/;
const depsReplacement = `$1,\n${WEBRTC_PACKAGE_LINE}\n$2`;
let patched = original.replace(depsRegex, depsReplacement);

if (patched === original) {
  console.error(
    "[inject-webrtc-spm] 실패: dependencies 배열의 KakaoLoginPlugin 라인을 찾지 못했습니다. cap CLI 가 출력 포맷을 바꿨는지 확인 필요.",
  );
  process.exit(1);
}

// 2) target dependencies 의 마지막 .product(...) 항목 뒤에 WebRTC product 라인 추가.
const targetRegex = /(\.product\(name: "CapacitorKakaoLoginPlugin"[^\n]+)\n(\s+\]\n\s+\)\n\s+\])/;
const targetReplacement = `$1,\n${WEBRTC_PRODUCT_LINE}\n$2`;
patched = patched.replace(targetRegex, targetReplacement);

if (!patched.includes(WEBRTC_PRODUCT_LINE)) {
  console.error(
    "[inject-webrtc-spm] 실패: target dependencies 의 KakaoLoginPlugin product 라인을 찾지 못했습니다.",
  );
  process.exit(1);
}

writeFileSync(PACKAGE_SWIFT, patched, "utf8");
console.log(
  "[inject-webrtc-spm] stasel/WebRTC SPM 의존성을 Package.swift 에 재주입했습니다.",
);
