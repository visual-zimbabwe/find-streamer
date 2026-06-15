import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Jimp from 'jimp-compact';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const source = path.resolve(
  'C:/Users/jeanm/.cursor/projects/d-Dev-labs-find-streamer/assets/trova-icon-light-foreground-mockup.png',
);
const output = path.join(projectRoot, 'icon-light.png');

function isCheckerboardPixel(r, g, b) {
  if (Math.abs(r - g) > 8 || Math.abs(g - b) > 8) return false;
  return r >= 150;
}

async function main() {
  const image = await Jimp.read(source);
  if (image.bitmap.width !== 1024 || image.bitmap.height !== 1024) {
    image.resize(1024, 1024);
  }

  image.scan(0, 0, image.bitmap.width, image.bitmap.height, function scan(_x, _y, idx) {
    const r = this.bitmap.data[idx];
    const g = this.bitmap.data[idx + 1];
    const b = this.bitmap.data[idx + 2];
    if (isCheckerboardPixel(r, g, b)) {
      this.bitmap.data[idx + 3] = 0;
    }
  });

  await image.writeAsync(output);
  console.log(`Wrote ${output} (${image.bitmap.width}x${image.bitmap.height})`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
