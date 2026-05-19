# 통화 녹음 — Backend API 사양

- 작성일: 2026-05-20
- 대응 클라 작업: PR #118 (`feat/#116-recording` 가 base 로 사용 예정)
- 대응 FE spec: `docs/superpowers/specs/2026-05-19-call-recording-design.md`

## 1. Use case 개요

- LingRing 통화는 1:1 P2P (WebRTC SRTP) — **서버에 음원 없음**
- 양쪽 클라이언트가 **자기 마이크 입력만** 각자 녹음 (AAC 64kbps mono m4a)
- 통화 종료 시 클라가 S3 로 직접 업로드 (presigned PUT URL)
- 업로드 완료 후 BE 에 통보 → BE 가 AI 분석 파이프라인 enqueue
- 한 통화에 양쪽 클라가 각각 업로드 → **`(callId, userId)` 쌍이 unique key**

## 2. 도메인 모델 — call vs room

```
call (Long id, 상위)
  └─ room (UUID id, 하위 — signaling room session)
```

- **call** = 통화 entity (매칭 결과로 생성, AI 분석 단위, 녹음 종속 단위)
- **room** = call 안의 signaling room (WebRTC peer connection 의 공간)
- **녹음은 call 단위** — recording 의 unique key 는 `(callId, userId)`

### callId 노출 — Matching response 확장 (BE 작업 필수)

클라는 현재 `roomId` 만 받음. callId 도 필요.

```diff
  MatchingStatusResponse {
    status: MatchingPollStatus,
    partnerId: Long,
    roomId: UUID,
+   callId: Long              // 매칭 성공 시점에 생성된 call entity 의 id
  }
```

- 전제: BE 가 `MATCHED` 응답 만드는 시점에 call entity 가 이미 생성되어 있어야 함 (callId 가 그때 존재)
- 만약 call entity 생성 시점이 다르다면 (예: 시그널링 시점) 본 사양 §3·§4 의 URL 을 재검토 필요 — 그 경우 시그널링 wire 에 callId 포함 옵션 고려

## 3. 엔드포인트 1 — Presigned URL 발급

```
POST /calls/:callId/recording/presign
Authorization: Bearer <accessToken>
Content-Type: application/json
```

`:callId` 는 **Long** (Path variable).

### Request

```json
{
  "contentType": "audio/m4a",
  "sizeBytes": 4900000
}
```

| 필드 | 타입 | 설명 |
|---|---|---|
| `contentType` | string | 항상 `"audio/m4a"` (AAC LC mono) |
| `sizeBytes` | number | 클라가 계산한 파일 크기. S3 PUT condition 으로 사용 |

### Response (envelope.status = SUCCESS)

```json
{
  "status": "SUCCESS",
  "data": {
    "uploadUrl": "https://lingring-recordings.s3.ap-northeast-2.amazonaws.com/...?X-Amz-Signature=...",
    "storageKey": "recordings/2026/05/<callId>/<userId>.m4a",
    "expiresAt": "2026-05-20T01:23:45Z"
  }
}
```

| 필드 | 타입 | 설명 |
|---|---|---|
| `uploadUrl` | string | S3 PUT presigned URL (10 분 만료 권장) |
| `storageKey` | string | S3 object key. BE 가 정의 — `recordings/<YYYY>/<MM>/<callId>/<userId>.m4a` 권장 |
| `expiresAt` | ISO8601 | presigned URL 만료 시각 |

### 인증·권한 검증 (BE 책임)

- 토큰 유효성
- `callId` 가 실제 통화고 요청 user 가 그 통화 참여자인지 검증 (참여자 아니면 403)
- 이미 같은 `(callId, userId)` 로 complete 된 녹음 있으면 409 (멱등성)

### 에러 케이스

| 상황 | status | message |
|---|---|---|
| 토큰 만료/없음 | 401 | (envelope) |
| 해당 통화 참여자 아님 | 403 | `"forbidden_call"` |
| `callId` 존재 안 함 | 404 | `"call_not_found"` |
| `sizeBytes` 가 상한 초과 (예: 50MB) | 400 | `"file_too_large"` |
| 같은 통화에 이미 업로드 완료 | 409 | `"already_uploaded"` |
| `contentType` 이 `audio/m4a` 아님 | 400 | `"unsupported_content_type"` |

## 4. 엔드포인트 2 — 업로드 완료 통보

```
POST /calls/:callId/recording/complete
Authorization: Bearer <accessToken>
Content-Type: application/json
```

### Request

```json
{
  "storageKey": "recordings/2026/05/123/45.m4a",
  "durationMs": 600000,
  "sizeBytes": 4900000,
  "codec": "aac",
  "sampleRate": 24000
}
```

| 필드 | 타입 | 설명 |
|---|---|---|
| `storageKey` | string | presign 응답의 `storageKey` 그대로 |
| `durationMs` | number | 녹음 길이 (ms) |
| `sizeBytes` | number | 최종 파일 크기 |
| `codec` | string | 항상 `"aac"` |
| `sampleRate` | number | `24000` (Hz) |

### Response

```json
{
  "status": "SUCCESS",
  "data": { "recordingId": "rec_<id>" }
}
```

### BE 처리

1. `storageKey` 가 해당 user 의 presign 발급 결과인지 검증 (보안 — 다른 user 의 storageKey 도용 차단)
2. S3 HeadObject 로 실제 업로드 됐는지 확인
3. DB 에 `recording` entity 저장 (§6)
4. AI 분석 파이프라인 enqueue (§7)
5. `recordingId` 반환

### 에러 케이스

| 상황 | status |
|---|---|
| `storageKey` 가 요청 user 소유 아님 | 403 `"forbidden_storage_key"` |
| S3 에 실제 파일 없음 (업로드 실패한 상태) | 404 `"object_not_found"` |
| 이미 complete 처리됨 | 200 (멱등 — 같은 `recordingId` 반환) |

## 5. S3 인프라 요구사항

### Bucket 설정

- Bucket 명 예: `lingring-recordings-prod` (region: `ap-northeast-2`)
- **Public access 차단** — presigned URL 로만 접근
- **Server-side encryption** (AES-256)
- **Versioning** off (불필요)

### Lifecycle Rule

```
ID: auto-delete-7d
Prefix: recordings/
Action: Expiration after 7 days
```

7 일 후 자동 삭제. 분석 완료 후 더 빨리 삭제하고 싶으면 BE 가 명시 DeleteObject 호출.

### IAM 정책 (BE 서버용)

- `s3:PutObject` (presigned URL 발급 권한)
- `s3:GetObject` (AI 분석 service 가 fetch)
- `s3:DeleteObject` (사용자 탈퇴 시 cascade)
- `s3:HeadObject` (complete 단계 확인)

### CORS 설정

클라가 presigned URL 로 PUT 하려면 bucket CORS 필요:

```json
{
  "CORSRules": [{
    "AllowedOrigins": ["capacitor://localhost", "ionic://localhost", "http://localhost:5173"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }]
}
```

Capacitor iOS WebView 의 origin 은 `capacitor://localhost`. dev 는 vite (`http://localhost:5173`).

## 6. DB Schema 권장

### `call_recording` table

| 컬럼 | 타입 | 비고 |
|---|---|---|
| `id` | BIGINT PK auto-increment | `recordingId` |
| `call_id` | BIGINT FK → `call.id` | NOT NULL |
| `user_id` | BIGINT FK → `user.id` | NOT NULL — 녹음한 사용자 |
| `storage_key` | TEXT | NOT NULL UNIQUE |
| `duration_ms` | INT | |
| `size_bytes` | BIGINT | |
| `codec` | VARCHAR(16) | `'aac'` |
| `sample_rate` | INT | `24000` |
| `analysis_status` | ENUM(`PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`) | 분석 파이프라인 상태 |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

UNIQUE constraint: `(call_id, user_id)` — 같은 통화·사용자 조합은 한 번만.

## 7. AI 분석 trigger

- `complete` endpoint 의 4 번 단계에서 메시지 큐 (SQS / RabbitMQ) 또는 직접 호출로 분석 service 에 enqueue
- 분석 service 는:
  1. S3 GetObject 로 음원 fetch
  2. STT + LLM 으로 발음·표현·문법 분석
  3. 결과를 `call_recording.analysis_*` 컬럼 또는 별도 `call_analysis_report` table 에 저장
  4. `analysis_status` 업데이트
  5. (선택) S3 object 즉시 삭제 — 7 일 lifecycle 보다 빠른 폐기
- **분석 service 의 정확한 architecture 는 본 사양 범위 밖** — FE 는 `analysis_status` 와 결과 read API 만 필요

## 8. 사용자 탈퇴 cascade

메모리 정책: 탈퇴 시 즉시 hard-delete (개인정보).

- `POST /me/withdraw` 처리 시 해당 user 의 모든 `call_recording` row 삭제
- 각 row 의 `storage_key` 로 S3 DeleteObject

## 9. 보안 정책

| 항목 | 정책 |
|---|---|
| 인증 | 모든 endpoint 는 JWT Bearer 필수 |
| 권한 | presign / complete 모두 통화 참여자만. callId·userId join 검증 |
| Storage key 도용 | complete 단계에서 `storage_key` 가 해당 user 의 presign 결과인지 검증 |
| Presigned URL 만료 | 10 분 |
| Bucket 공개 | 차단 — presigned URL 로만 접근 |
| TLS | S3·BE 모두 HTTPS only |

## 10. 응답 envelope 컨벤션 (#98 fix 정합)

모든 응답은 HTTP 200 + body 의 `status` 필드로 분기:

```json
// 성공
{ "status": "SUCCESS", "data": { ... } }

// 실패
{ "status": "FAILED", "code": "forbidden_call", "message": "..." }
```

FE 의 `ApiError` 처리가 이 envelope 컨벤션에 맞춰져 있음.

## 11. 클라이언트 사용 흐름 (참고용)

```
[매칭 성공]
  ↓
GET /matching/status → MatchingStatusResponse { ..., roomId, callId }
                                                          ↑
                                                       신규 필드
  ↓
[통화 진입 → 통화 진행 → 통화 종료]
  ↓
(1) POST /calls/:callId/recording/presign
    → { uploadUrl, storageKey, expiresAt }
  ↓
(2) PUT <uploadUrl>  (body = m4a raw bytes)
    Content-Type: audio/m4a
    → 200 OK
  ↓
(3) POST /calls/:callId/recording/complete
    body: { storageKey, durationMs, sizeBytes, codec, sampleRate }
    → { recordingId }
  ↓
(클라) 임시 파일 삭제

[다음 앱 실행 — 잔여 파일 발견 시]
  → (1)~(3) 재시도 (멱등)
```

## 12. BE 작업 체크리스트

- [ ] `MatchingStatusResponse` 에 `callId: Long` 필드 추가 (`MATCHED` 응답 시 채움)
- [ ] `POST /calls/:callId/recording/presign` endpoint 구현
- [ ] `POST /calls/:callId/recording/complete` endpoint 구현
- [ ] `call_recording` 테이블 생성 (§6)
- [ ] S3 bucket 생성 + 정책·CORS·Lifecycle 설정 (§5)
- [ ] IAM 역할 + presigned URL 발급 권한
- [ ] AI 분석 파이프라인 enqueue 연동 (§7)
- [ ] 사용자 탈퇴 cascade 에 `call_recording` 삭제 추가 (§8)

## 13. FE 측 협의 항목

- `callId` 타입 = `Long` (UUID 아님). FE 측 type 도 `number` 로 통일
- `roomId` 는 그대로 UUID 유지 (signaling 용)
- presign URL 만료 시간 (현 10 분 가정) 적절한지
- 보존 정책 (현 7 일 lifecycle) 출시 전 재검토
- `analysis_status` read 흐름은 별도 PR (AI 피드백 리포트 화면)
