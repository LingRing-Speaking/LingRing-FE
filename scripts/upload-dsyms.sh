#!/bin/sh
# Xcode Build Phase "Upload dSYMs to Sentry" (For install builds only)에서 실행된다 (#199).
# Archive 시 생성되는 dSYM 을 Sentry 에 업로드해 네이티브 크래시 심볼화를 가능하게 한다.
#
# 원칙: 이 스크립트는 어떤 경우에도 빌드를 깨지 않는다 (항상 exit 0).
# 토큰 미설정·dSYM 없음·업로드 실패 → 경고만 남기고 Archive 는 계속 진행된다.

set -u

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.env"

log() { echo "[upload-dsyms] $1"; }

# Xcode GUI 는 셸 환경변수를 물려받지 않는다 — .env 에서 직접 읽는다.
# 셸/CI 에서 이미 준 환경변수가 있으면 그쪽을 우선한다.
read_env() {
  [ -f "$ENV_FILE" ] || return 0
  sed -n "s/^$1=//p" "$ENV_FILE" | tail -1
}

SENTRY_AUTH_TOKEN="${SENTRY_AUTH_TOKEN:-$(read_env SENTRY_AUTH_TOKEN)}"
SENTRY_ORG="${SENTRY_ORG:-$(read_env SENTRY_ORG)}"
SENTRY_PROJECT="${SENTRY_PROJECT:-$(read_env SENTRY_PROJECT)}"

if [ -z "$SENTRY_AUTH_TOKEN" ] || [ -z "$SENTRY_ORG" ] || [ -z "$SENTRY_PROJECT" ]; then
  log "SENTRY_AUTH_TOKEN/SENTRY_ORG/SENTRY_PROJECT 미설정 — dSYM 업로드 건너뜀 (.env.example 참고)"
  exit 0
fi

# Xcode 가 이번 빌드의 dSYM 위치를 환경변수로 넘겨준다 (Release: dwarf-with-dsym).
DSYM_DIR="${DWARF_DSYM_FOLDER_PATH:-}"
if [ -z "$DSYM_DIR" ] || [ ! -d "$DSYM_DIR" ]; then
  log "dSYM 폴더 없음('${DSYM_DIR}') — 업로드 건너뜀"
  exit 0
fi

# sentry-cli 는 @sentry/vite-plugin 의존성으로 이미 설치돼 있다 — 신규 의존성 없음.
SENTRY_CLI="$PROJECT_ROOT/node_modules/.bin/sentry-cli"
if [ ! -x "$SENTRY_CLI" ]; then
  log "sentry-cli 없음 — npm install 후 다시 Archive 하세요. 업로드 건너뜀"
  exit 0
fi

log "dSYM 업로드 시작: $DSYM_DIR"
if SENTRY_AUTH_TOKEN="$SENTRY_AUTH_TOKEN" "$SENTRY_CLI" debug-files upload \
    --org "$SENTRY_ORG" --project "$SENTRY_PROJECT" "$DSYM_DIR"; then
  log "dSYM 업로드 완료"
else
  log "경고: dSYM 업로드 실패 — 빌드는 계속됩니다. 수동 업로드:"
  log "  SENTRY_AUTH_TOKEN=<token> $SENTRY_CLI debug-files upload --org $SENTRY_ORG --project $SENTRY_PROJECT '$DSYM_DIR'"
fi

exit 0
