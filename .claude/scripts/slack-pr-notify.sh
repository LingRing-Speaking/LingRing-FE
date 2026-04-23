#!/usr/bin/env bash
set -euo pipefail

PR_URL="${1:-}"
PR_TITLE="${2:-}"
ISSUE_NUM="${3:-}"

if [ -z "$PR_URL" ] || [ -z "$PR_TITLE" ]; then
  echo "usage: slack-pr-notify.sh <pr_url> <pr_title> [issue_num]" >&2
  exit 2
fi

PROJECT_ROOT=$(git rev-parse --show-toplevel)
ENV_FILE="$PROJECT_ROOT/.env"
if [ -f "$ENV_FILE" ]; then
  set -a
  . "$ENV_FILE"
  set +a
fi

if [ -z "${SLACK_FRONTEND_TOKEN:-}" ] || [ -z "${SLACK_FRONTEND_PR_CHANNEL:-}" ]; then
  echo "slack skipped: SLACK_FRONTEND_TOKEN or SLACK_FRONTEND_PR_CHANNEL not set"
  exit 0
fi

ISSUE_TITLE=""
if [ -n "$ISSUE_NUM" ]; then
  ISSUE_TITLE=$(gh issue view "$ISSUE_NUM" --json title -q .title 2>/dev/null || echo "")
fi

if [ -n "$ISSUE_TITLE" ]; then
  MSG="\"${ISSUE_TITLE}\" 작업에 대해 PR 올렸습니다!! 시간날 때 확인 부탁드려요!🙂 <${PR_URL}|${PR_TITLE}>"
else
  MSG="PR 올렸습니다!! 시간날 때 확인 부탁드려요!🙂 <${PR_URL}|${PR_TITLE}>"
fi

PAYLOAD=$(jq -cn --arg ch "$SLACK_FRONTEND_PR_CHANNEL" --arg text "$MSG" '{channel:$ch,text:$text}')

curl -s -X POST \
  -H "Authorization: Bearer $SLACK_FRONTEND_TOKEN" \
  -H "Content-Type: application/json; charset=utf-8" \
  --data "$PAYLOAD" \
  https://slack.com/api/chat.postMessage