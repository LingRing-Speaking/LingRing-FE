import type { CapacitorConfig } from '@capacitor/cli';

const OTA_UPDATE_URL =
  process.env.VITE_OTA_UPDATE_URL ?? 'http://localhost:8888/manifest.json';

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
    CapacitorUpdater: {
      autoUpdate: true,
      updateUrl: OTA_UPDATE_URL,
      statsUrl: '',
      channelUrl: '',
      autoDeleteFailed: true,
      autoDeletePrevious: true,
      resetWhenUpdate: false,
    },
  },
};

export default config;
