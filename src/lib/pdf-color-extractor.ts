import type { TextLine } from '../types/page-model';
import type { Rect } from './coordinates';

/**
 * Pixel-based colour measurement: the fallback for text colour (TY-3) and the background colour and
 * uniformity behind a line (ADR-0004). Pure functions over RGBA pixel buffers so they are unit-testable
 * without a canvas.
 */

export interface Raster {
  readonly width: number;
  readonly height: number;
  /** RGBA, row-major, top-left origin. */
  readonly data: Uint8ClampedArray | Uint8Array;
}

export interface BackgroundSample {
  /** Dominant colour as upper-case hex. */
  readonly color: string;
  /** Fraction of ring samples in the dominant bucket. */
  readonly ratio: number;
  readonly uniform: boolean;
}

/** A ring whose dominant bucket holds less than this share of samples is non-uniform (design D9). */
export const UNIFORM_RATIO = 0.9;
/** Ring thickness in raster pixels (2-4 pt at scale 1). */
export const RING_WIDTH = 3;
const BUCKET_SHIFT = 4;
/** RGB distance from the background beyond which a pixel counts as ink. */
const INK_DISTANCE = 60;

const hex = (r: number, g: number, b: number): string =>
  '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();

function clipToRaster(r: Raster, rect: Rect): { x0: number; y0: number; x1: number; y1: number } {
  return {
    x0: Math.max(0, Math.floor(rect.x)),
    y0: Math.max(0, Math.floor(rect.y)),
    x1: Math.min(r.width, Math.ceil(rect.x + rect.width)),
    y1: Math.min(r.height, Math.ceil(rect.y + rect.height)),
  };
}

interface Bucket {
  count: number;
  r: number;
  g: number;
  b: number;
}

/** Dominant colour among pixels the visitor yields, with the share of samples it holds. */
function dominant(raster: Raster, visit: (emit: (x: number, y: number) => void) => void): BackgroundSample | null {
  const buckets = new Map<number, Bucket>();
  let total = 0;
  visit((x, y) => {
    const i = (y * raster.width + x) * 4;
    const r = raster.data[i] ?? 0;
    const g = raster.data[i + 1] ?? 0;
    const b = raster.data[i + 2] ?? 0;
    const k = ((r >> BUCKET_SHIFT) << 8) | ((g >> BUCKET_SHIFT) << 4) | (b >> BUCKET_SHIFT);
    const bucket = buckets.get(k) ?? { count: 0, r: 0, g: 0, b: 0 };
    bucket.count++;
    bucket.r += r;
    bucket.g += g;
    bucket.b += b;
    buckets.set(k, bucket);
    total++;
  });
  if (total === 0) return null;
  let best: Bucket | null = null;
  for (const bucket of buckets.values()) if (!best || bucket.count > best.count) best = bucket;
  if (!best) return null;
  const ratio = best.count / total;
  return { color: hex(best.r / best.count, best.g / best.count, best.b / best.count), ratio, uniform: ratio >= UNIFORM_RATIO };
}

/**
 * Dominant colour and uniformity of a ring just outside `rect` (raster pixel coordinates, top-left origin).
 * Returns null when the ring lies entirely off the raster.
 */
export function sampleRing(raster: Raster, rect: Rect, width: number = RING_WIDTH): BackgroundSample | null {
  const outer = clipToRaster(raster, { x: rect.x - width, y: rect.y - width, width: rect.width + 2 * width, height: rect.height + 2 * width });
  const innerX0 = Math.floor(rect.x);
  const innerY0 = Math.floor(rect.y);
  const innerX1 = Math.ceil(rect.x + rect.width);
  const innerY1 = Math.ceil(rect.y + rect.height);
  return dominant(raster, (emit) => {
    for (let y = outer.y0; y < outer.y1; y++) {
      for (let x = outer.x0; x < outer.x1; x++) {
        if (x >= innerX0 && x < innerX1 && y >= innerY0 && y < innerY1) continue;
        emit(x, y);
      }
    }
  });
}

/**
 * Text colour estimated from the rendered glyphs inside `rect`: the pixels farthest from the local
 * background, averaged. Returns null when no pixel differs enough from the background to be ink.
 */
export function sampleGlyphColor(raster: Raster, rect: Rect): string | null {
  const area = clipToRaster(raster, rect);
  const background = dominant(raster, (emit) => {
    for (let y = area.y0; y < area.y1; y++) for (let x = area.x0; x < area.x1; x++) emit(x, y);
  });
  if (!background) return null;
  const bg = [1, 3, 5].map((o) => parseInt(background.color.slice(o, o + 2), 16));
  const ink: { d: number; r: number; g: number; b: number }[] = [];
  for (let y = area.y0; y < area.y1; y++) {
    for (let x = area.x0; x < area.x1; x++) {
      const i = (y * raster.width + x) * 4;
      const r = raster.data[i] ?? 0;
      const g = raster.data[i + 1] ?? 0;
      const b = raster.data[i + 2] ?? 0;
      const d = Math.hypot(r - (bg[0] ?? 0), g - (bg[1] ?? 0), b - (bg[2] ?? 0));
      if (d > INK_DISTANCE) ink.push({ d, r, g, b });
    }
  }
  if (ink.length === 0) return null;
  // Anti-aliasing blends glyph edges toward the background, so the extremes best approximate the true colour.
  ink.sort((p, q) => q.d - p.d);
  const core = ink.slice(0, Math.max(1, Math.ceil(ink.length * 0.1)));
  const mean = (pick: (p: (typeof core)[number]) => number) => core.reduce((s, p) => s + pick(p), 0) / core.length;
  return hex(mean((p) => p.r), mean((p) => p.g), mean((p) => p.b));
}

/** CSS hex colour string, e.g. `#ff0000`. */
export type CssHex = string;

/** Round an 0–255 channel value to the nearest multiple of 5. */
const PALETTE_ROUND = 5;
function roundChannel(v: number): number {
  return Math.round(v / PALETTE_ROUND) * PALETTE_ROUND;
}

/**
 * Extract the set of unique fill colors from the given Text Lines, deduplicating by rounding each
 * RGB channel to the nearest 5. Returns at most 16 colors (TY-10).
 */
export function extractPalette(lines: TextLine[]): CssHex[] {
  const seen = new Set<string>();
  const result: CssHex[] = [];
  for (const line of lines) {
    if (line.color.source === 'pending') continue;
    const h = line.color.hex.replace('#', '').toLowerCase().padStart(6, '0');
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    const key = `${roundChannel(r)},${roundChannel(g)},${roundChannel(b)}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(line.color.hex);
      if (result.length >= 16) break;
    }
  }
  return result;
}
