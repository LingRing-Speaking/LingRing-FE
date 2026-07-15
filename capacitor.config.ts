import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.lingring.app',
  appName: 'LingRing',
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: '#FFFFFF',
      iosSplashResourceName: 'Splash',
      androidSplashResourceName: 'splash',
      splashFullScreen: true,
      splashImmersive: true,
    },
    // 구글만 사용. 미설정 시 Facebook SDK 까지 번들되어 Android 매니페스트에
    // 광고 ID 권한(AD_ID)이 들어간다 → Play Console 광고 ID 선언 걸림.
    SocialLogin: {
      providers: {
        google: true,
        facebook: false,
        twitter: false,
      },
    },
    // manual 모드: 플러그인의 auto-update(updateUrl POST)를 끄고, 정적 manifest 를
    // 직접 fetch 해 download/next 로 적용한다 (src/lib/ota.ts).
    CapacitorUpdater: {
      autoUpdate: false,
      autoDeleteFailed: true,
      autoDeletePrevious: true,
      // 앱스토어 네이티브 업데이트 시 구 OTA 번들 대신 새 builtin 으로 리셋한다.
      resetWhenUpdate: true,
    },
  },
};

export default config;
