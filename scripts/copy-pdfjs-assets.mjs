// Copies PDF.js runtime data (CMaps, standard fonts, WASM decoders, ICC profiles)
// into public/pdfjs so they are served from our own origin and precached (design D2).
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const pdfjsRoot = dirname(require.resolve('pdfjs-dist/package.json'));
const target = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'pdfjs');

rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
for (const dir of ['cmaps', 'standard_fonts', 'wasm', 'iccs']) {
  const src = join(pdfjsRoot, dir);
  if (existsSync(src)) cpSync(src, join(target, dir), { recursive: true });
}
console.log(`PDF.js assets copied to ${target}`);
