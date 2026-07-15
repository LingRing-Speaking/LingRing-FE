# Sentry 크래시·에러 모니터링 도입 (MVP) 설계

- 날짜: 2026-07-11
- 티켓: #198 (후속: #199 — 네이티브 심볼화·CI 자동화)
- 상태: 승인됨

## 목표

Capacitor로 래핑된 iOS/Android 실기기에서 발생하는 JS 런타임 에러·네이티브
크래시를 Sentry(SaaS)로 수집하고, 대시보드에서 "어떤 환경의 어떤 버전에서
몇 명에게" 발생했는지 확인할 수 있게 한다.

## 범위 (A안 — MVP 수신 파이프라인)

**포함:**

- `@sentry/capacitor` 설치 + 런타임 초기화 (JS + 네이티브 레이어 포착)
- dev/prod environment · release 태깅
- React ErrorBoundary + fallback 화면 (흰 화면 방지)
- 사용자 식별 (서버 발급 userId만)
- JS 소스맵 업로드 (prod 빌드 시, `@sentry/vite-plugin`)
- 실기기 수신 검증

**제외 (→ #199):**

- iOS dSYM · Android ProGuard 매핑 업로드 (네이티브 크래시 심볼화)
- CI/빌드 파이프라인 자동화 확장

네이티브 크래시는 이번 범위에서도 **포착은 되지만** 스택트레이스가 주소로
표시된다. 발생 사실·기기·버전 정보는 확인 가능.

## 핵심 결정

| 결정 | 선택 | 근거 |
|---|---|---|
| Sentry 플랜 | SaaS 무료(Developer) 티어 | 월 에러 5,000건·1 seat. 초기 규모에 충분, 한도 도달 시 Team 승격 |
| dev/prod 분리 | **단일 프로젝트 + `environment` 태그** | Sentry 표준 패턴. DSN 1개, 대시보드 필터로 분리. 무료 티어 쿼터 통합 |
| 환경값 주입 | **전용 env 변수** (`VITE_SENTRY_*`) | OTA(`VITE_OTA_UPDATE_URL`)와 동일한 채널 빌드 주입 멘탈 모델. 명시적 |
| DSN 미설정 시 | **warn 로그 + 초기화 skip** | OTA 패턴과 동일. 웹 개발·로컬 QA에서 Sentry 없이 정상 동작. throw 금지 |
| 사용자 식별 | **서버 발급 userId만** (`Sentry.setUser({ id })`) | 영향 사용자 수 집계. userId는 서버 랜덤 발급 불투명 값 — PII 아님. email·name·닉네임 미전송, `sendDefaultPii: false` |
| ErrorBoundary | **Sentry ErrorBoundary + 최소 fallback** | 렌더 크래시 시 흰 화면 방지 + component stack 확보 |
| 성능 트레이싱 | `tracesSampleRate: 0` | 도입 목적은 에러 추적. 쿼터 절약 |
| Session Replay | 미설치 | 무료 50건/월 — 불필요, 금방 소진 |

## 구성 요소

### 1. 패키지

- `@sentry/capacitor@^4.2.0` — 네이티브(sentry-cocoa/sentry-android) + JS 브릿지.
  peer `@capacitor/core >=3.0.0` → Capacitor 8 호환 확인됨
- `@sentry/react@10.60.0` — peer 정확 버전 고정. `ErrorBoundary` 제공
- `@sentry/vite-plugin` (devDependency) — 소스맵 업로드

### 2. 런타임 초기화 — `src/lib/sentry.ts` (신규)

```
initSentry(): void
  - VITE_SENTRY_DSN 미설정 → console.warn + return (skip)
  - Sentry.init({
      dsn, environment, release,
      tracesSampleRate: 0,
      sendDefaultPii: false,
    })

setSentryUser(userId: string | null): void
  - userId → Sentry.setUser({ id: userId })
  - null → Sentry.setUser(null)
```

- `main.tsx`의 `bootstrap()` **최상단**에서 `initSentry()` 호출 —
  OTA 초기화 실패까지 포착 범위에 들어오도록.

### 3. ErrorBoundary — `src/components/ErrorFallback.tsx` (신규)

- `main.tsx`에서 `<App />`을 `@sentry/react`의 `ErrorBoundary`로 감싼다.
- fallback: 브랜드 톤(민트/코랄)의 얇은 화면 — "문제가 발생했어요" 문구 +
  "다시 시도" 버튼(`resetError`).

### 4. 사용자 식별 연동

- 인증 확정 시점(로그인 성공/세션 복원)에 `setSentryUser(userId)` 호출.
- 로그아웃·탈퇴 시 `setSentryUser(null)`.
- 구체 훅 위치는 기존 auth 도메인 흐름을 따른다 (`src/domains/auth`).

### 5. 환경 변수 & 빌드 주입

| 변수 | 값 | 주입 위치 |
|---|---|---|
| `VITE_SENTRY_DSN` | Sentry 프로젝트 DSN (공개 가능 값) | `.env` / 채널 빌드 스크립트 |
| `VITE_SENTRY_ENVIRONMENT` | `dev` \| `prod` | 채널 빌드 스크립트 (`build:ios:dev/prod` 등) |
| `VITE_SENTRY_RELEASE` | `major.minor.커밋수` — OTA 버전과 동일 계산 | 채널 빌드 스크립트 |
| `SENTRY_AUTH_TOKEN` | org 토큰 — **소스맵 업로드 전용, 클라 번들에 미포함** | 로컬 `.env`(gitignore) / 추후 CI secret |

- `.env.example`에 전부 문서화 (OTA 변수 서술 스타일에 맞춤).
- release 계산은 `scripts/build-ota-bundle.mjs`의 커밋수 방식과 정합 유지 —
  중복 구현하지 말고 공통화 가능하면 공통화.

### 6. JS 소스맵 업로드 (`vite.config.ts`)

- `@sentry/vite-plugin`은 **vite 프로덕션 빌드 중 `SENTRY_AUTH_TOKEN`이 존재할
  때만** 활성화 — 게이트는 토큰 존재 여부 하나로 통일한다 (채널 무관.
  dev 채널 QA 빌드도 토큰이 있으면 심볼화 혜택).
- 토큰 없으면 skip — 빌드는 계속 성공해야 한다 (로컬·웹 개발 무영향).
- 업로드 후 번들 내 소스맵 노출 방지 설정 확인 (public 배포물에 `.map` 미포함).

## 에러 처리 방침

- Sentry 자체가 죽어도 앱은 죽지 않는다 — init 실패는 try/catch로 삼키고 warn.
- 노이즈 필터링(네트워크 타임아웃 등 `ignoreErrors`)은 실데이터를 본 뒤
  후속으로 추가한다 (YAGNI — 미리 추측해 필터하지 않음).

## 테스트 (커버리지 80% 유지)

- `src/lib/sentry.test.ts` — `@sentry/capacitor` mock:
  - DSN 미설정 시 `Sentry.init` 미호출 + warn
  - DSN 설정 시 environment/release/PII 옵션이 올바르게 전달
  - `setSentryUser` — id 전달 / null 클리어
- `ErrorFallback` 렌더 테스트 — 문구·다시 시도 버튼 동작(`resetError` 호출).
- ErrorBoundary 통합(에러 던지는 자식 → fallback 렌더) 테스트.

## 리스크 & 구현 시 검증 항목

1. **iOS SPM 모드**: `@sentry/capacitor`의 sentry-cocoa 의존성이 SPM 모드에서
   정상으로 붙는지 확인. 필요 시 `scripts/inject-webrtc-spm.mjs` 패턴으로 수동
   주입. 동기화는 반드시 `npm run sync:ios` (직접 `cap sync ios` 금지).
2. **OTA 번들과 release 정합**: OTA로 JS만 갈아끼우면 네이티브 빌드와 JS 번들
   버전이 어긋날 수 있음 — release 값은 **JS 번들 기준**(OTA 버전과 동일
   계산)으로 통일한다.
3. **실기기 검증**: dev 채널 빌드에서 강제 JS 에러·강제 크래시를 발생시켜
   대시보드 수신을 확인한다. OTA가 로컬 QA를 덮어쓰지 않도록
   `VITE_OTA_UPDATE_URL` 없이 빌드.

## 선행 준비 (사용자 액션)

- sentry.io 계정/조직 생성, 프로젝트 1개 생성 → DSN 발급
- 소스맵 업로드용 auth token 발급 (`project:releases` 스코프)
