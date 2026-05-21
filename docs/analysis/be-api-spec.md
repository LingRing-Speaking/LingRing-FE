# 통화 분석 BE API 스펙 (FE 제안)

- 작성일: 2026-05-21
- 상태: BE 협의 대기
- 대응 GitHub 이슈: [#119 feat: 분석하기 페이지 및 분석하기 버튼 제작](https://github.com/LingRing-Speaking/LingRing-FE/issues/119)
- 작성 주체: FE
- 목적: 통화 기록 카드의 "분석하기 / 분석중 / 분석완료" 3상태 UI를 구현하려면 BE 측 분석 트리거·상태 조회 엔드포인트가 필요한데, BE 미구현 상태라 FE 가 먼저 스펙 안을 제안한다. BE 의견을 받아 확정한다.

## 1. 배경

- 통화 기록 응답(`GET /api/v1/calls`)의 각 아이템은 현재 `analyzed: boolean` 필드만 가짐 (BE PR #?? 기준). 이 필드만으로는 "분석 요청 직후 ~ 결과 도착 사이"의 진행 중 상태를 표현할 수 없다.
- FE 는 사용자가 카드의 "분석하기" 버튼을 누르면 즉시 "분석중"으로 전환되고, 분석이 끝나면 "분석 보기"로 자동 전환되는 UX 를 원한다.
- 분석은 LLM 호출 등으로 수 초~수십 초가 걸릴 수 있다고 가정한다. 동기 응답 대신 **트리거 + 폴링** 패턴을 제안한다.

## 2. 데이터 모델 변경

`CallHistoryItem.analyzed: boolean` → `analysisStatus: AnalysisStatus` 로 교체.

```ts
type AnalysisStatus = "NONE" | "IN_PROGRESS" | "COMPLETED";
```

| 상태 | 의미 | 카드 UI |
|---|---|---|
| `NONE` | 분석 요청 한 적 없음 | "분석하기" (primary) |
| `IN_PROGRESS` | 서버 분석 큐에 들어가 있거나 진행 중 | "분석중" (비활성 + 스피너) |
| `COMPLETED` | 분석 결과 저장 완료 | "분석 보기" (ghost) |

상태 전이:

```
NONE ──(트리거 호출)──▶ IN_PROGRESS ──(서버가 분석 끝내면)──▶ COMPLETED
                                                                  │
                                                          (재요청 불가, 종착 상태)
```

실패 케이스(분석 모듈 장애 등)는 FE 가 mutation 에러로 받아 카드를 `NONE` 으로 되돌리고 토스트로 안내. 별도 `FAILED` 상태는 이번 스펙에 포함하지 않는다 (필요해지면 추가).

## 3. 엔드포인트

### 3-1. 분석 트리거

```
POST /api/v1/calls/{callId}/analyze
```

- 인증: Bearer JWT (기존 동일)
- 요청 바디: 없음
- 성공 응답 (HTTP 200 / envelope status 200):
  ```json
  {
    "data": { "analysisStatus": "IN_PROGRESS" },
    "status": 200,
    "message": "OK"
  }
  ```
- 멱등성: 이미 `IN_PROGRESS` 인 통화에 다시 호출되면 그대로 `IN_PROGRESS` 응답 (새 작업 만들지 않음). 이미 `COMPLETED` 인 경우 409 또는 그대로 `COMPLETED` 응답 — BE 협의.
- 에러:
  - 404: 해당 callId 가 본인의 통화가 아님
  - 422: 통화가 너무 짧아 분석 대상이 아님 (메시지 명시)

### 3-2. 분석 상태 + 결과 조회 (폴링 + 결과 페이지 공용)

```
GET /api/v1/calls/{callId}/analysis
```

- 인증: Bearer JWT
- 성공 응답:
  ```json
  {
    "data": {
      "analysisStatus": "IN_PROGRESS",
      "result": null
    },
    "status": 200,
    "message": "OK"
  }
  ```
  또는 완료된 경우:
  ```json
  {
    "data": {
      "analysisStatus": "COMPLETED",
      "result": {
        "strengths": [...],
        "improvements": [...],
        "transcript": [...]
      }
    },
    "status": 200,
    "message": "OK"
  }
  ```
- `result` 내부 구조는 분석 결과 페이지 작업(별도 이슈)에서 확정. 이번 이슈에서는 `analysisStatus` 만 사용.
- 폴링 주기: FE 5초.

### 3-3. (참고) 통화 기록 목록

`GET /api/v1/calls` 응답 항목의 `analyzed: boolean` 을 `analysisStatus: AnalysisStatus` 로 교체.

```diff
  {
    "id": 42,
    "partner": { ... },
    "startedAt": "...",
    "durationSec": 323,
-   "analyzed": false
+   "analysisStatus": "NONE"
  }
```

## 4. 트랜잭션·동시성 노트 (BE 검토 요청)

- 동일 callId 에 대해 트리거가 동시에 두 번 들어와도 분석 작업은 1회만 실행되어야 함. DB 에 `(call_id UNIQUE)` 제약 또는 `INSERT … ON CONFLICT DO NOTHING` 패턴 권장.
- `COMPLETED` 도달 후 재트리거 정책은 BE 가 결정 (현재 FE 는 COMPLETED 카드에서 트리거 버튼을 보여주지 않음).

## 5. FE 임시 대응 (BE 합의 전)

- `src/mocks/handlers.ts` 에서 위 스펙대로 MSW 핸들러를 mock 구현. 시드 데이터는 NONE/IN_PROGRESS/COMPLETED 를 일정 비율로 분포시키고, 트리거 호출 시 ~6초 후 자동 COMPLETED 로 전환되는 timer 시뮬레이션을 추가한다.
- BE 가 다른 경로·페이로드로 결정하면 `callHistoryApi.ts` + `handlers.ts` 두 파일만 갱신하면 된다.
