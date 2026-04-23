---
description: 현재 브랜치의 커밋을 분석해 팀 컨벤션에 맞는 GitHub PR을 생성합니다
---

# GitHub PR 자동 생성

현재 브랜치에서 부모 브랜치로 향하는 PR을 만든다. 단계별로 이상이 보이면 멈추고 사용자에게 확인, 아니면 끝까지 이어서 진행.

## 1. 컨텍스트 수집 (병렬)

`git branch --show-current`, `git status`, `git remote get-url origin`, `git fetch origin`.

커밋되지 않은 변경사항이 있으면 **먼저 사용자에게 알리고** 진행 여부 확인.

## 2. 브랜치명 파싱

형식: `<type>/#<issue>-<desc>` (예: `feat/#12-jwt-auth`). 정규식 `^(?<type>[a-z]+)/#(?<issue>\d+)-(?<desc>.+)$`.

규칙 위배면 멈추고 이슈 번호·타입을 사용자에게 확인. 잘못 파싱해 엉뚱한 이슈에 `Closes`가 걸리면 피해가 크다.

## 3. 부모 브랜치 & 라벨

브랜치 전략: `main ← prod ← dev ← 작업 브랜치` (`hotfix`만 `prod`로 직행).

| 타입       | 부모   | 라벨        |
| ---------- | ------ |-----------|
| `feat`     | `dev`  | `feat`    |
| `fix`      | `dev`  | `bug`     |
| `hotfix`   | `prod` | `bug`     |
| `chore`    | `dev`  | `chore`   |
| `docs`     | `dev`  | `docs`    |
| `refactor` | `dev`  | `refactor`|
| `test`     | `dev`  | `refactor`|
| `dev`      | `prod` | —         |
| `prod`     | `main` | —         |

표에 없는 타입이면 부모 브랜치를 사용자에게 확인. 라벨이 저장소에 없으면(`gh label list`로 확인) `--label`을 생략해 PR 먼저 생성 후 사용자에게 알림.

## 4. 커밋·diff 분석

`git log origin/<parent>..HEAD`, `git diff origin/<parent>...HEAD --stat`, `git diff origin/<parent>...HEAD`로 실제 변경을 파악. 커밋 메시지 나열이 아니라 **이 PR이 뭘 바꾸는지** 한눈에 이해되게 풀어쓴다.

## 5. PR 제목

`<type>: <한국어 요약>`, 70자 이내 (예: `feat: 사용자 JWT 인증 추가`). 커밋이 혼재되면 가장 큰 변경을 대표.

## 6. PR 본문

`.github/pull_request_template.md` 구조 유지 (섹션 제목·이모지 포함).

```markdown
## 😉 연관 이슈

Closes #<이슈번호>

## 🚀 작업 내용

- <커밋·diff 기반 변경 내용>

## 💬 리뷰 중점사항

- <리뷰어가 특히 봐야 할 지점. 없으면 "특별한 주의점 없음">
```

## 7. 푸시 & PR 생성

원격 브랜치가 없거나 뒤처져 있으면 `git push -u origin <branch>` (`--force` 계열 금지).

```bash
gh pr create --base <parent> --head <branch> --label <label> \
  --title "<title>" --body "$(cat <<'EOF'
<body>
EOF
)"
```

같은 브랜치로 PR이 이미 열려있으면 덮어쓰지 말고 **업데이트 여부를 사용자에게 확인** (`gh pr edit`로 갱신). 성공 시 반환된 PR URL을 사용자에게 표시.

## 8. Slack 알림

Slack 알림 로직은 `.claude/scripts/slack-pr-notify.sh`로 분리되어 있다. 스크립트가 `.env`의 `SLACK_USER_TOKEN`·`SLACK_PR_CHANNEL`을 읽어 best-effort로 처리하며, 둘 중 하나라도 없으면 조용히 종료한다.

```bash
./.claude/scripts/slack-pr-notify.sh "<PR_URL>" "<PR_TITLE>" <이슈번호>
```

메시지는 스크립트 내부에서 `<URL|텍스트>` Slack mrkdwn 형식으로 조립된다. 응답 `"ok":false`여도 실패 한 줄만 알리고 **재시도 금지** — PR은 이미 생성됨.

## 실패 시 대응

- `gh` 미설치/인증 만료 → `brew install gh && gh auth login`
- 브랜치명 규칙 위배 → 2단계로 돌아가 사용자 확인
- 부모 브랜치 원격에 없음 → 사용자에게 확인
- 라벨이 저장소에 없음 → `--label` 생략해 PR 먼저 생성, 사용자에게 알림
- Slack 알림 실패 / `jq` 미설치 → PR 생성은 성공했으므로 **커맨드 전체 성공 처리**, 실패는 한 줄만 보고
- `slack-pr-notify.sh: Permission denied` → `chmod +x .claude/scripts/slack-pr-notify.sh` 후 재시도