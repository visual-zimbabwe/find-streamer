import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setIconAsync } from '@expo/prebuild-config/build/plugins/icons/withAndroidIcons.js';
import fs from 'node:fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

const ICON_BACKGROUND = '#F7F7F2';
const SPLASH_BACKGROUND = '#0C0C0E';

async function updateColorsXml() {
  const colorsPath = path.join(projectRoot, 'android/app/src/main/res/values/colors.xml');
  let xml = await fs.readFile(colorsPath, 'utf8');
  xml = xml.replace(
    /<color name="splashscreen_background">[^<]+<\/color>/,
    `<color name="splashscreen_background">${SPLASH_BACKGROUND}</color>`,
  );
  xml = xml.replace(
    /<color name="iconBackground">[^<]+<\/color>/,
    `<color name="iconBackground">${ICON_BACKGROUND}</color>`,
  );
  await fs.writeFile(colorsPath, xml, 'utf8');
  console.log(`Updated ${colorsPath}`);
}

async function main() {
  await setIconAsync(projectRoot, {
    icon: './icon-light.png',
    backgroundColor: ICON_BACKGROUND,
    backgroundImage: null,
    monochromeImage: null,
    isAdaptive: true,
  });
  await updateColorsXml();
  console.log('Android launcher mipmaps regenerated from icon-light.png');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
