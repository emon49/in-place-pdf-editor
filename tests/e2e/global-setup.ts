import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PDFDocument, StandardFonts } from 'pdf-lib';
// @ts-expect-error -- plain JS dev helper without type declarations
import { encodePng } from '../../scripts/png.mjs';

export const GENERATED_DIR = join(import.meta.dirname, '..', 'fixtures', 'generated');
export const PERF_FIXTURE = join(GENERATED_DIR, 'perf-10-pages-5mb.pdf');

/** Deterministic pseudo-random bytes (mulberry32) so the fixture is stable across runs. */
function prng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 10-page PDF of about 5 MB: each page has text and an incompressible noise image (task 7.5). */
async function makePerfFixture(): Promise<void> {
  const doc = await PDFDocument.create({ updateMetadata: false });
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const rand = prng(42);
  for (let p = 0; p < 10; p++) {
    const png: Uint8Array = encodePng(420, 420, () => [rand() * 256, rand() * 256, rand() * 256, 255].map(Math.floor));
    const image = await doc.embedPng(png);
    const page = doc.addPage([612, 792]);
    page.drawText(`Performance fixture page ${p + 1} of 10 (fictional content)`, { x: 54, y: 740, size: 14, font });
    page.drawImage(image, { x: 126, y: 300, width: 360, height: 360 });
  }
  writeFileSync(PERF_FIXTURE, await doc.save());
}

export default async function globalSetup(): Promise<void> {
  mkdirSync(GENERATED_DIR, { recursive: true });
  if (!existsSync(PERF_FIXTURE)) await makePerfFixture();
}
