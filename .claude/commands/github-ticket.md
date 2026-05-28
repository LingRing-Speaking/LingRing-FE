---
description: 유저 설명을 받아 LingRing Projects에 티켓(이슈+프로젝트 아이템)을 생성합니다
---

# GitHub Project Ticket 자동 생성

유저가 준 설명·repo·우선순위·작업크기를 받아 **대상 repo에 이슈를 만들고**, 동시에 **LingRing 프로젝트(org project #1)에 아이템으로 추가**하면서 Priority/Size/Status 필드를 세팅합니다. 우리 팀의 모든 작업 이슈는 이 커맨드로 만든다는 전제(= 보드를 거치지 않는 이슈는 만들지 않는다)입니다.

브랜치 생성은 이 커맨드의 책임이 아닙니다 — 실제로 작업을 시작할 때 `/github-ticket-start`로 따로 처리합니다.

## 프로젝트/필드 메타데이터 (하드코딩)

값이 자주 바뀌지 않지만, 누가 프로젝트 구조를 바꾸면 갱신해야 합니다. 갱신은 `gh project field-list 1 --owner LingRing-Speaking --format json`으로 확인.

- **Org**: `LingRing-Speaking`
- **Project number**: `1`
- **Project ID**: `PVT_kwDOEIj-h84BVqej`

| Field | Field ID | Option | Option ID |
|---|---|---|---|
| Status | `PVTSSF_lADOEIj-h84BVqejzhRExG8` | Backlog | `f75ad846` |
| | | Ready | `61e4505c` |
| | | In progress | `47fc9ee4` |
| | | In review | `df73e18b` |
| | | Done | `98236657` |
| Priority | `PVTSSF_lADOEIj-h84BVqejzhRExLU` | High | `79628723` |
| | | Medium | `0a877460` |
| | | Low | `da944a9c` |
| Size | `PVTSSF_lADOEIj-h84BVqejzhRExLY` | XS | `6c6483d2` |
| | | S | `f784b110` |
| | | M | `7515a9f1` |
| | | L | `817d0097` |
| | | XL | `db339eb2` |

## 동작 순서

각 단계의 **의도**를 이해하고 이상이 보이면 사용자에게 확인을 요청하세요. 티켓은 생성 즉시 보드에 노출되고 팀원에게 보입니다 — 제목·본문·메타데이터를 **생성 직전에 보여주고 승인받은 뒤** 진행하세요.

### 1. 메타데이터 수집

`AskUserQuestion` 한 번에 묶어서 받습니다 (이미 커맨드 인자로 들어왔다면 해당 항목은 스킵).

- **Repo**: `LingRing-BE` / `LingRing-FE`
- **Priority**: `High` / `Medium` / `Low`
- **Size**: `XS` / `S` / `M` / `L` / `XL`

Status는 기본 `Backlog`로 고정 — 유저가 명시적으로 다른 값을 요청하지 않는 한 묻지 않습니다.
Assignee는 기본 `@me`(현재 gh user).

### 2. 컨텍스트 수집

대상 repo가 정해진 뒤 병렬로 읽어옵니다.

- `gh api repos/LingRing-Speaking/<repo>/contents/.github/ISSUE_TEMPLATE/bug-template.md --jq .content | base64 -d`
- `gh api repos/LingRing-Speaking/<repo>/contents/.github/ISSUE_TEMPLATE/task-template.md --jq .content | base64 -d`

> 두 repo 모두 같은 파일명을 사용하지만 내용은 다를 수 있으니 **타겟 repo의 템플릿을 직접 읽어야** 합니다.

### 3. 템플릿 타입 판정

유저 입력의 맥락으로 `bug` / `task` 중 하나를 고릅니다. 애매하면 묻습니다.

| 템플릿 | 판정 힌트 |
|---|---|
| `bug` | 기존 동작이 깨짐, 에러/예외/스택트레이스·로그 언급, "안 돼요", "작동하지 않음", 재현 조건이 나옴 |
| `task` | 신규 기능, 개선, 리팩토링, 문서 작업, 설정 추가, "~ 구현/추가/개선" |

### 4. 작업 타입 & 라벨 결정

한국어 Conventional Commits용 `type`을 고르고, `type` → 라벨로 매핑합니다.

| 상황                | type | 라벨 |
|-------------------|---|---|
| 새 기능/엔드포인트/엔티티 추가 | `feat` | `feat` |
| 버그 수정             | `fix` | `bug` |
| 프로덕션 장애성 긴급 수정    | `hotfix` | `bug` |
| 빌드/의존성/설정/초기 세팅   | `chore` | `chore` |
| 문서만 변경            | `docs` | `docs` |
| 코드 구조 변경/개선       | `refactor` | `refactor` |
| 테스트만 추가/수정        | `test` | `refactor` |

매핑된 라벨이 대상 repo에 없으면 `gh issue create --label`이 실패합니다. 이 경우 `--label`을 생략해 이슈를 먼저 만들고, **누락을 사용자에게 알린 뒤** 필요하면 `gh label create -R LingRing-Speaking/<repo>`로 생성 후 `gh issue edit --add-label`로 부착하세요. 현재 라벨은 `gh label list -R LingRing-Speaking/<repo>`로 확인.

### 5. 제목 작성

한국어 Conventional Commits — `<type>: <한국어 요약>` (예: `feat: 사용자 JWT 인증 추가`).

- 70자 이내
- 유저 입력의 구체적 대상(파일/기능/엔드포인트)을 그대로 반영
- 외삽으로 범위를 과도하게 확장하지 말 것. 모르는 건 본문에 "미확인"으로 남기세요.

### 6. 본문 작성

선택한 템플릿을 **그대로 복제**해서 각 섹션을 채웁니다. 섹션 제목(이모지 포함)과 순서는 원본과 정확히 일치시키세요.

- 유저 입력에서 **직접 추론 가능한 내용만** 채웁니다.
- 값을 모르는 섹션은 템플릿의 안내 blockquote(`>`)를 **원본 그대로 남기고 본문은 비워두세요**.
- 유저가 재현 단계/기대 결과를 줬다면 Given-When-Then으로 정리. 없는 걸 지어내지 말 것.

### 7. 사용자 승인

여기서 멈춥니다. 아래를 한 블록에 모아 보여주고 확인을 받으세요.

- 대상 repo
- 템플릿 타입 (bug / task)
- 제목
- 라벨
- Priority / Size / Status / Assignee
- 본문 전체 미리보기

"이대로 진행할까요?" 식으로 묻고, 승인 전에는 **이슈/프로젝트 아이템을 생성하지 않습니다**.

### 8. 생성

세 단계로 나누어 실행합니다.

**(1) 이슈 생성** — issue URL을 캡처해야 다음 단계에서 사용 가능.

```bash
ISSUE_URL=$(gh issue create \
  -R LingRing-Speaking/<repo> \
  --title "<title>" \
  --label <label> \
  --assignee @me \
  --body "$(cat <<'EOF'
<body 전체>
EOF
)")
echo "$ISSUE_URL"
```

**(2) 프로젝트에 추가** — 반환되는 item ID를 캡처.

```bash
ITEM_ID=$(gh project item-add 1 \
  --owner LingRing-Speaking \
  --url "$ISSUE_URL" \
  --format json --jq .id)
```

**(3) 필드 세팅** — 위 메타데이터 표의 ID를 사용해 Priority/Size/Status 각각 호출.

```bash
# Priority
gh project item-edit \
  --id "$ITEM_ID" \
  --project-id PVT_kwDOEIj-h84BVqej \
  --field-id PVTSSF_lADOEIj-h84BVqejzhRExLU \
  --single-select-option-id <priority_option_id>

# Size
gh project item-edit \
  --id "$ITEM_ID" \
  --project-id PVT_kwDOEIj-h84BVqej \
  --field-id PVTSSF_lADOEIj-h84BVqejzhRExLY \
  --single-select-option-id <size_option_id>

# Status (Backlog 기본)
gh project item-edit \
  --id "$ITEM_ID" \
  --project-id PVT_kwDOEIj-h84BVqej \
  --field-id PVTSSF_lADOEIj-h84BVqejzhRExG8 \
  --single-select-option-id f75ad846
```

### 9. 결과 보고

- 이슈 URL
- 프로젝트 보드 URL (`https://github.com/orgs/LingRing-Speaking/projects/1`)
- 세팅된 필드값 요약 (Priority / Size / Status / Assignee / Label)
- 다음 단계 안내: 작업 시작 시 `/github-ticket-start`로 브랜치 생성

## 실패 시 대응

- `gh` 미설치 → `brew install gh && gh auth login` 안내
- 인증 만료 / 스코프 부족(`read:project` 또는 `project`) → `gh auth refresh -s project,read:project` 안내
- 매핑된 라벨이 repo에 없음 → `--label` 생략해 이슈 먼저 생성, 사용자에게 알림
- 템플릿 파일이 없거나 섹션 구조가 바뀜 → 멈추고 사용자에게 최신 템플릿을 확인받은 뒤 진행
- 필드 ID/옵션 ID가 더 이상 유효하지 않음(프로젝트 구조 변경) → `gh project field-list 1 --owner LingRing-Speaking --format json`으로 새 ID를 받아 이 문서 상단 표를 갱신하라고 안내