# 릴리스 & 버전 가이드

## 버전은 3종류 (분리해서 본다)

| 종류 | 무엇 | 어디 | 누가 봄 |
|---|---|---|---|
| **git 태그** | 소스 릴리스 마커 | `git tag` | 개발자 (롤백·추적·재현) |
| **iOS 스토어 버전** | App Store 제출본 | `ios/App/App.xcodeproj` → `MARKETING_VERSION` + `CURRENT_PROJECT_VERSION`(build) | App Store / 유저 |
| **Android 스토어 버전** | Play 제출본 | `android/app/build.gradle` → `versionName` + `versionCode`(커밋 수 자동) | Play / 유저 |

iOS·Android는 **독립 스토어**라 버전이 서로 달라도 정상. git 태그 ≠ 스토어 버전.

## 태그 컨벤션

- **BE (서버)**: 단일 `vX.Y.Z` (배포 대상이 prod 서버 하나)
- **FE (모바일, 2스토어)**: **플랫폼별 태그, 숫자 = 그 스토어 제출 버전**
  - `ios-1.2.0` = "이 커밋으로 App Store 1.2.0 빌드함"
  - `android-1.2.0` = "이 커밋으로 Play 1.2.0 빌드함"
- 원칙: **스토어에 낸 것만 태그.** 제품용 통합 태그(`v*`)는 FE에서 쓰지 않는다 (숫자 중복으로 혼란).

## 릴리스 플로우 (FE)

### 1) 네이티브 변경 포함 → 스토어 제출 필수
(녹음/권한/플러그인/네이티브 코드 변경. OTA 불가)
1. 작업 브랜치 → dev → 검증 → **dev→prod 머지 (반드시 "Create a merge commit")**
2. 제출할 플랫폼의 버전 bump:
   - iOS: Xcode에서 `MARKETING_VERSION`(예 1.2.0) + build number 증가
   - Android: `versionName` bump (versionCode는 커밋 수로 자동)
3. `npm run build:ios:prod` / `build:android:prod` → Archive/AAB → 스토어 제출
4. 제출한 커밋에 태그 + GitHub Release: `git tag ios-1.2.0 <commit>` / `android-1.2.0 <commit>`
5. **바뀐 플랫폼만 제출.** 안 바뀐 플랫폼은 아무것도 안 함 (버전 그대로).

### 2) JS/웹만 변경 → OTA (스토어 재심사 없음)
- `npm run deploy:ota:prod` → 설치된 양 플랫폼 앱에 즉시 반영. 스토어 버전·태그 변경 불필요(또는 OTA 번들 버전 규칙 따름).

## ⚠️ iOS 버전 증가 주의
App Store는 새 `MARKETING_VERSION`이 **현재 스토어 버전보다 커야** 한다. Apple은 컴포넌트별 정수 비교(`1.2.0` 끝의 `.0`은 `1.2`와 동일 취급될 수 있음). 현재 스토어 버전을 확인하고 명확히 큰 값으로 올릴 것.

## dev↔prod 충돌 방지
- dev→prod는 **항상 일반 머지**(Create a merge commit). 스쿼시 금지 (long-lived 브랜치 재머지 시 충돌 폭탄).
- prod에 hotfix를 직접 했으면 **반드시 dev로 back-merge** (안 하면 다음 릴리스에서 누락·충돌).
