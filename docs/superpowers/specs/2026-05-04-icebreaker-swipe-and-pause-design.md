# Icebreaker 카드 스와이프 + 일시정지 디자인

작성일: 2026-05-04
대상 화면: 매칭 대기열(`/matching`) — `IcebreakerRotator`

## 배경

현재 매칭 대기 화면은 추천 문장 5개를 7초 간격으로 자동 순환해서 보여준다.
사용자가 (1) 한 문장을 천천히 읽고 싶거나 (2) 방금 지나간 문장을 다시 보고 싶을 때 개입할 수단이 없다.
좌우 스와이프 제스처와 "터치 중 일시정지"를 도입해 사용자가 페이스를 가져갈 수 있게 한다.

## 결정 사항 요약

| 항목 | 결정 |
|---|---|
| 인터랙션 | 좌우 스와이프 제스처 (버튼 없음) |
| 방향 | 양방향 — 왼쪽=다음, 오른쪽=이전 |
| 경계 처리 | 랩어라운드 (양 끝에서 반대편으로 순환) |
| 스와이프 후 자동 타이머 | 7초로 리셋 |
| 카드 누르고 있는 동안 | 자동 회전 일시정지 |
| 손가락 뗀 후 (스와이프 아닌 경우) | 7초 타이머 새로 시작 |

## 책임 분리

| 모듈 | 추가/변경 |
|---|---|
| `useSentenceRotation` (훅) | `goNext()`, `goPrev()`, `pause()`, `resume()` 4개 함수 추가 노출. 자동 타이머는 내부에서 관리하되, `goNext/goPrev` 호출 시 자동 7초 타이머 리셋. `pause` 동안 타이머 정지, `resume`에서 7초 새로 시작. |
| `IcebreakerRotator` (컴포넌트) | `onTouchStart` / `onTouchMove` / `onTouchEnd` / `onTouchCancel` 핸들러 추가. 제스처 해석만 담당하고 결과를 훅 함수 호출로 위임. |

훅에 모든 상태·타이머 로직을 두면 제스처 라이브러리 없이도 단위 테스트 가능하고, 컴포넌트는 키보드 등 다른 입력 방식을 나중에 붙일 때 훅을 재사용할 수 있다.

## 제스처 해석 규칙

`touchstart`에서 무조건 `pause()` 호출. 별도 long-press 임계치를 두지 않는다 — 짧은 탭도 "일시정지 → 즉시 재개"로 처리되어 사용자 체감에 영향이 없고, long-press와 swipe-start 분기 로직이 사라져 단순해진다.

`touchend`에서 누적 좌표를 보고:
- 수평 이동 ≥ `SWIPE_THRESHOLD_PX` (=50) 이고 수평이 수직보다 우세하면
  - deltaX < 0 (왼쪽 스와이프) → `goNext()`
  - deltaX > 0 (오른쪽 스와이프) → `goPrev()`
  - 두 함수 모두 내부적으로 자동 7초 타이머 리셋 포함
- 그 외 (탭, 수직 우세 제스처, 임계치 미달) → `resume()` 호출 → 7초 새로 시작

`touchcancel` (시스템 인터럽트, 화면 이탈 등)도 `resume()`으로 처리.

`SWIPE_THRESHOLD_PX = 50`은 `IcebreakerRotator.tsx` 안에 둔다 (응집도 규칙 — 한 곳에서만 쓰임).

## 엣지케이스

| 상황 | 처리 |
|---|---|
| 문장 0개 또는 1개 | 자동 회전이 이미 안 돌고 있음. 제스처 핸들러도 일찍 리턴해 의미 없는 호출 방지. |
| 페이드 트랜지션(280ms) 중 스와이프 | 무시하지 않고 즉시 적용. 트랜지션은 다음 인덱스 기준으로 재진행. 별도 락 두지 않음(YAGNI). |
| 점 인디케이터 | `index` 변경에 따라 자동으로 active 점이 바뀌므로 추가 작업 없음. |
| 손가락이 카드를 벗어나며 끝남 | `touchend`는 시작 요소에서 발생하므로 그대로 동작. `touchcancel` 발생 시 `resume()` 처리. |

## 테스트 시나리오

### 훅 단위 테스트 — `useSentenceRotation.test.ts` (신규)

Vitest fake timers 사용.

- `goNext()` → `index` +1, 자동 타이머가 7초로 리셋됨 (6.9초 진행해도 자동 변화 없음)
- `goPrev()` → `index` −1, 동일하게 타이머 리셋
- 인덱스 0에서 `goPrev()` → 마지막 인덱스 (랩어라운드)
- 마지막 인덱스에서 `goNext()` → 0
- `pause()` 후 시간 진행 → `index` 안 바뀜
- `pause()` → `resume()` → 7초 후 `index` +1
- 문장 1개일 때 `goNext()` / `goPrev()` 호출해도 `index` 0 유지

### 컴포넌트 통합 테스트 — `IcebreakerRotator.test.tsx` (신규)

`fireEvent.touchStart` → `touchMove` → `touchEnd`로 제스처 모사.

- 왼쪽 스와이프 (deltaX = −60) → 다음 문장 노출
- 오른쪽 스와이프 (deltaX = +60) → 이전 문장 노출
- 임계치 미달 스와이프 (deltaX = −30) → 변경 없음 + 자동 회전 재개
- 수직 우세 제스처 (deltaX = −20, deltaY = 80) → 변경 없음
- `touchStart`만 유지하고 시간 진행 → `index` 안 바뀜 / `touchEnd` 후 7초 뒤 진행

기존 `MatchingPage.test.tsx`의 자동 회전 검증은 영향 없음 — 상수(`ROTATION_INTERVAL_MS`, `FADE_MS`) 그대로 유지.

## Out of scope

- 점 인디케이터를 탭해서 특정 인덱스로 점프
- 키보드 네비게이션 (모바일 전용 앱)
- 햅틱 피드백
- 별도 long-press 임계치/안내 UI
