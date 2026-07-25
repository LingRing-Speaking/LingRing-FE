/**
 * Android 런처 아이콘 · 스플래시를 브랜드 로고에서 생성한다.
 *
 * 실행: npm run assets:android
 *
 * 1. 로고(iOS 앱 아이콘)를 잘라 @capacitor/assets 용 소스(assets/*.png)를 만든다
 * 2. @capacitor/assets 로 밀도별 리소스를 생성한다
 * 3. adaptive 아이콘 배경을 단색으로 되돌린다 (아래 주석 참고)
 *
 * 주의 — @capacitor/assets 는 네이티브 프로젝트를 Trapeze 로 열면서 AndroidManifest.xml
 * 과 ios/App/App.xcodeproj/project.pbxproj 를 의미 없이 재포맷한다. 아이콘과 무관하니
 * 실행 후 두 파일은 `git checkout --` 으로 되돌린다.
 *
 * 로고 크기 — iOS 아이콘의 로고 폭은 캔버스의 69.3% 다. @capacitor/assets 가
 * adaptive 아이콘 XML 에 16.7% inset 을 넣어 108dp 중 가운데 72dp(런처 마스크가
 * 덮는 최대 영역)에 맞춰주므로, 소스는 iOS 와 같은 비율 그대로 두면 된다.
 */
import { execFileSync } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { glob } from 'node:fs/promises';
import sharp from 'sharp';

const SOURCE_LOGO = 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png';
const RES_DIR = 'android/app/src/main/res';
const BACKGROUND = '#FFFFFF';

const ICON_SIZE = 1024;
const SPLASH_SIZE = 2732;

const ICON_LOGO_RATIO = 0.693; // iOS 앱 아이콘과 동일한 로고 비율
const SPLASH_LOGO_RATIO = 0.15;

/** 흰 배경을 잘라내 로고 픽셀만 남긴다. */
function extractLogo() {
  return sharp(SOURCE_LOGO).flatten({ background: BACKGROUND }).trim({ threshold: 5 }).toBuffer();
}

/** 흰 정사각 캔버스 가운데에 로고를 지정 비율로 얹는다. */
async function composeOnCanvas(logo, canvasSize, logoRatio, outPath) {
  const scaled = await sharp(logo)
    .resize({ width: Math.round(canvasSize * logoRatio) })
    .toBuffer();

  await sharp({
    create: { width: canvasSize, height: canvasSize, channels: 3, background: BACKGROUND },
  })
    .composite([{ input: scaled, gravity: 'centre' }])
    .png()
    .toFile(outPath);
}

function solidCanvas(size, outPath) {
  return sharp({ create: { width: size, height: size, channels: 3, background: BACKGROUND } })
    .png()
    .toFile(outPath);
}

/**
 * @capacitor/assets 는 배경도 16.7% inset 된 비트맵으로 깔아서 108dp 캔버스의
 * 바깥 18dp 가 투명하게 남는다. 런처 마스크·패럴랙스가 그 영역을 건드리면 흰
 * 아이콘의 모서리가 잘려 보일 수 있으므로 배경은 단색 리소스로 되돌린다.
 */
async function useSolidAdaptiveBackground() {
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background" />
    <foreground>
        <inset android:drawable="@mipmap/ic_launcher_foreground" android:inset="16.7%" />
    </foreground>
</adaptive-icon>
`;
  for (const name of ['ic_launcher.xml', 'ic_launcher_round.xml']) {
    await writeFile(`${RES_DIR}/mipmap-anydpi-v26/${name}`, xml);
  }
  for await (const file of glob(`${RES_DIR}/mipmap-*/ic_launcher_background.png`)) {
    await rm(file);
  }
  // Capacitor 기본 로고 벡터 — adaptive 아이콘이 mipmap 을 쓰므로 더는 쓰이지 않는다
  await rm(`${RES_DIR}/drawable-v24/ic_launcher_foreground.xml`, { force: true });
}

/**
 * 쓰지 않는 리소스 변형을 지운다.
 * - night: @capacitor/assets 가 배경 #111 다크 스플래시를 만드는데, SplashScreen
 *   플러그인 backgroundColor 는 흰색이라 다크모드에서 검정→흰색으로 튄다.
 * - ldpi: 120dpi 기기는 사실상 없고, 없으면 상위 밀도에서 다운스케일된다.
 */
async function removeUnusedVariants() {
  for (const pattern of [`${RES_DIR}/drawable*night*`, `${RES_DIR}/*-ldpi`]) {
    for await (const dir of glob(pattern)) {
      await rm(dir, { recursive: true, force: true });
    }
  }
}

await mkdir('assets', { recursive: true });
const logo = await extractLogo();

await composeOnCanvas(logo, ICON_SIZE, ICON_LOGO_RATIO, 'assets/icon.png');
await composeOnCanvas(logo, ICON_SIZE, ICON_LOGO_RATIO, 'assets/icon-foreground.png');
await solidCanvas(ICON_SIZE, 'assets/icon-background.png');
await composeOnCanvas(logo, SPLASH_SIZE, SPLASH_LOGO_RATIO, 'assets/splash.png');

execFileSync('npx', ['@capacitor/assets', 'generate', '--android'], { stdio: 'inherit' });
await useSolidAdaptiveBackground();
await removeUnusedVariants();

console.log('\nAndroid 아이콘 · 스플래시 생성 완료');
