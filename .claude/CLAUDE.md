# CLAUDE.md

이 파일은 이 저장소에서 작업할 때 Claude Code (claude.ai/code)에 주는 가이드입니다.

## 프로젝트 개요

LingRing-FE는 **LingRing**의 프론트엔드입니다. LingRing은 한국어 사용자 대상 영어 회화 연습 앱 — 1:1 실시간 음성 통화 랜덤 매칭, 통화 후 AI 피드백, 게이미피케이션. 백엔드는 별도 저장소 **LingRing-BE**가 담당하며, 이 저장소는 UI · 클라이언트 상태 · WebRTC 피어 셋업 · 네이티브 통합만 다룹니다.

## 기술 스택

저장소는 아직 스캐폴드 전입니다 (HTML 목업 10개 + 프로필 이미지만 존재). 아래 스택을 전제로 구현하세요. 대안 제안은 맥락이 분명한 경우에만.

- TypeScript · React 18 · Vite · Tailwind CSS · React Router v6
- Zustand (클라이언트 상태) · TanStack Query (서버 상태)
- React Hook Form + Zod · Radix UI (모달/바텀시트/토글)
- **Capacitor 6** 으로 iOS/Android 래핑 (React Native · Flutter 아님)
- FCM + `@capacitor/push-notifications`
- `@capacitor-community/kakao-login`, `@capacitor-community/apple-sign-in`
- Sentry

## 배포 타깃

**iOS + Android 전용.** 웹 빌드는 개발 편의용이며 실제 배포 제품이 아닙니다. 데스크톱 브라우저 · SEO · SSR에 노력을 쓰지 마세요.

## Capacitor 통합 모델

UI는 전체가 웹(HTML/CSS/React). 네이티브는 Capacitor 플러그인을 JS에서 호출하는 방식으로만 섞입니다.

```tsx
<button onClick={async () => {
  await PushNotifications.requestPermissions();  // 내부적으로 Swift/Kotlin 실행
}}>알림 켜기</button>
```

웹(개발)과 네이티브(배포)에서 API가 다르면 분기:

```ts
if (Capacitor.isNativePlatform()) await PushNotifications.register();
```

WebRTC (`getUserMedia`, `RTCPeerConnection`)는 WebView에서 그대로 동작 — 별도 플러그인 불필요.

## 저장소 루트의 HTML 파일

`lingring_*.html` 10개는 **디자인 목업**이며 프로덕션 코드가 아닙니다. 파일명이 화면 목적을 드러냅니다 (예: `lingring_call.html` = 통화 화면). 단 `lingring_brand.html`은 모바일 화면이 아닌 브랜드 가이드로, **Tailwind 테마 토큰**(민트 · 코랄 · Pretendard 폰트)의 출처입니다.

## 이 저장소 범위 밖

백엔드 API · WebRTC 시그널링/TURN 인프라 · STT(Whisper)/LLM 추론은 모두 서버 사이드에서 처리합니다.

## 코드 작성 규칙

코드를 쓰거나 수정할 때는 `.claude/rules/` 하위 원칙을 따르세요:

- `readability.md` — 가독성 (매직 넘버, 추상화, 조건 분리, 삼항, 시선 이동, 조건 명명)
- `predictability.md` — 예측 가능성 (반환 타입 일관성, SRP, 서술적 이름)
- `cohesion.md` — 응집도 (폼 응집도, 도메인 단위 디렉토리, 상수 위치)
- `coupling.md` — 결합도 (섣부른 추상화 피하기, 상태 범위, Composition)
