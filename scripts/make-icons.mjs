// Generates the PWA PNG icons in public/ (same motif as public/icon.svg).
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePng } from './png.mjs';

const pub = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const BG = [30, 41, 59, 255];
const PAPER = [248, 250, 252, 255];
const FOLD = [203, 213, 225, 255];
const BLUE = [37, 99, 235, 255];
const GREY = [148, 163, 184, 255];

for (const size of [192, 512]) {
  const u = size / 64; // design grid of icon.svg
  const png = encodePng(size, size, (px, py) => {
    const x = px / u;
    const y = py / u;
    const inRect = (x0, y0, w, h) => x >= x0 && x < x0 + w && y >= y0 && y < y0 + h;
    if (inRect(25, 31, 18, 3)) return BLUE;
    if (inRect(25, 38, 14, 3)) return GREY;
    // Page with a folded corner: x 20..48, y 12..52, fold triangle at top-right (37..48, 12..23).
    if (inRect(20, 12, 28, 40)) {
      if (x >= 37 && y < 23) return y >= x - 25 ? FOLD : BG;
      return PAPER;
    }
    return BG;
  });
  writeFileSync(join(pub, `icon-${size}.png`), png);
  console.log(`icon-${size}.png (${png.length} bytes)`);
}
