# 네이티브 크래시 심볼화 + OTA 안전 하드닝 설계

- 날짜: 2026-07-11
- 티켓: #199 (선행: #198 / PR #200)
- 상태: 승인됨

## 배경 — 이 티켓이 해결하는 것

#198 로 JS·네이티브 크래시 **수집**은 완성됐다. 그러나 iOS 네이티브 크래시의
스택트레이스는 메모리 주소로만 도착해 **판독이 불가능**하다. 주소↔원본코드
지도 파일(dSYM)을 빌드마다 Sentry 에 업로드해야 `파일명:줄번호`로 복원된다.

이 티켓은 "수집 추가"가 아니라 **"이미 수집되는 네이티브 크래시를 읽을 수
있게 만드는 배관 공사"** 다. 별도 CI 서버는 만들지 않는다 — 기존 로컬
빌드 루틴(npm 스크립트 → Xcode Archive)에 업로드를 심는다.

## 범위

**포함:**

1. **iOS dSYM 자동 업로드** — 티켓의 본체
2. **`enableNative` 하드닝** — #198 의 배포 안전장치 동승 (심볼화와 무관)
3. Android 업로드 생략 근거 문서화

**제외:**

- 원격 CI(GitHub Actions 등) — 로컬 빌드 체제라 불필요 (YAGNI)
- Android mapping 업로드 — 아래 근거 참조
- WebRTC 프리빌트 `.so`/framework 심볼 — 구글 배포물, 우리가 심볼을 갖고 있지 않음

## 1. iOS dSYM 자동 업로드

### 구성 요소 (파일 2개)

**`scripts/upload-dsyms.sh` (신규, git 관리)**

- 프로젝트 루트 `.env`에서 `SENTRY_AUTH_TOKEN`/`SENTRY_ORG`/`SENTRY_PROJECT` 로드
  (Xcode GUI 는 셸 환경변수를 물려받지 않으므로 파일에서 직접 읽어야 함.
  셸/CI 에서 준 환경변수가 있으면 그쪽 우선)
- 셋 중 하나라도 없으면 → 경고 로그 + `exit 0` (**빌드 절대 불가침**)
- dSYM 폴더(`DWARF_DSYM_FOLDER_PATH`) 없거나 sentry-cli 미설치 → 같은 방식 스킵
- 모두 있으면 → `node_modules/.bin/sentry-cli debug-files upload` 실행
  (sentry-cli 는 `@sentry/vite-plugin` 의존성으로 이미 설치돼 있음 — 신규 의존성 0)
- **업로드가 실패해도 exit 0** — Sentry 가 배포를 막아선 안 된다.
  실패 시 수동 업로드 명령을 로그로 안내

**`ios/App/App.xcodeproj/project.pbxproj` (수정)**

- App 타겟 buildPhases 에 `PBXShellScriptBuildPhase` "Upload dSYMs to Sentry" 추가
- `runOnlyForDeploymentPostprocessing = 1` (**"For install builds only"**) —
  평소 개발 빌드(Cmd+R/시뮬레이터)에선 실행되지 않고 **Archive 시에만** 동작.
  빌드 속도 영향 0
- 스크립트 본문은 pbxproj 에 인라인하지 않고 `"${SRCROOT}/../../scripts/upload-dsyms.sh"`
  호출 한 줄만 — 로직은 git 으로 리뷰·수정 가능하게 스크립트 파일에 둔다

### 전제 확인 완료

- Release 빌드 설정이 이미 `DEBUG_INFORMATION_FORMAT = dwarf-with-dsym` —
  Archive 시 dSYM 생성됨, Xcode 설정 변경 불필요
- Debug 는 `dwarf` (dSYM 없음) — install-only 조건과 함께 이중 안전

### 사용자 배포 루틴 변화

**없음.** `npm run build:ios:prod` → Xcode Archive → Organizer 업로드 그대로.
Archive 중에 dSYM 업로드가 자동으로 끼어들 뿐이다.

## 2. `enableNative` 하드닝 (OTA 안전핀)

- **문제**: 스토어의 구 바이너리(네이티브 Sentry 플러그인 없음)에 OTA 로 새 JS 가
  내려가면 `initNativeSdk` 가 "Native Client is not available" 를 throw (async).
- **해결**: `initSentry()` 에서 `Capacitor.isPluginAvailable("SentryCapacitor")` 를
  확인해 `enableNative` 에 전달. 플러그인 없으면 JS 전용 모드로 우아하게 강등
  (throw 없음, JS 에러 추적은 정상 동작). `enableNativeNagger: false` 로 SDK 잔소리 억제.
- **적용 시점 제약**: 다음 prod OTA 배포 전에 머지돼야 안전 보장. 이 브랜치가 적기.
- 웹(dev)에서도 plugin 미가용 → 자연스럽게 JS 전용 (기존과 동일 동작).

## 3. Android — 업로드 생략 (근거)

- `android/app/build.gradle` 이 `minifyEnabled false` — R8/ProGuard 난독화 미사용.
  JVM/Kotlin 은 컴파일 후에도 클래스·메서드명이 보존되므로 **스택트레이스가
  이미 원본 그대로 읽힌다.** 지도 파일이 애초에 필요 없음 (iOS Swift 는 기계어
  컴파일이라 무조건 dSYM 필요 — 여기가 두 플랫폼의 차이).
- **미래 조건**: `minifyEnabled true` 로 켜는 날 Sentry Gradle Plugin 으로
  mapping 업로드를 추가해야 한다 — build.gradle 에 주석으로 명시해 둔다.

## 테스트 / 검증

- 하드닝: `sentry.test.ts` 에 플러그인 유무 × `enableNative` 옵션 유닛 테스트 추가
  (`@capacitor/core` mock)
- 스크립트: 스킵 경로(토큰 없음/dSYM 없음) 수동 실행 검증 — exit 0 확인
- E2E (사용자 액션): auth token 발급 → `.env` 추가 → Archive 1회 →
  sentry.io Settings → Debug Files 에 dSYM 확인 → 실기기 강제 네이티브 크래시
  → 심볼화된 스택(`파일명:줄번호`) 복원 확인

## 선행 준비 (사용자 액션)

- sentry.io → Settings → Auth Tokens 발급 (`project:releases`, `project:write` 스코프)
- `.env` 에 `SENTRY_AUTH_TOKEN=` / `SENTRY_ORG=` / `SENTRY_PROJECT=` 채우기
  (.env.example 에 이미 문서화돼 있음 — #198)
