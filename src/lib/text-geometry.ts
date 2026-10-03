import { multiplyMatrix, pageRectToDisplay, pageToDisplayMatrix, type Matrix, type PageGeometry, type Rect } from './coordinates';
import type { LockReason } from '../types/page-model';

/**
 * Pure maths for turning PDF.js text fragments into Text Lines (ADR-0002, design D6-D8).
 * Fragments are compared in Display space so a `/Rotate 90` page merges along the visual line, and
 * results are stored back in Page Space.
 */

/** Tunable merge thresholds, in em (multiples of the font size). Single constants by design (see design.md). */
export const MERGE = {
  /** Maximum baseline difference for two fragments to share a line. */
  baselineTolerance: 0.2,
  /** Maximum horizontal gap (or overlap) at which neighbours still merge. */
  maxGap: 0.25,
  /** Minimum gap at which a space is inserted between merged fragments. */
  spaceGap: 0.08,
  /** Font sizes closer than this (in pt) count as equal. */
  sizeTolerance: 0.01,
  /** Skew beyond this makes a run rotated/skewed after the page rotation is removed. */
  skewTolerance: 1e-6,
} as const;

/** Drawing state that must be equal for fragments to merge. */
export interface TextStyleState {
  /** Fill colour identity (hex, or a marker for unresolved colours). */
  readonly colorKey: string;
  readonly renderMode: number;
  /** Percent. */
  readonly hScale: number;
  readonly charSpacing: number;
  readonly wordSpacing: number;
  readonly rise: number;
}

export const DEFAULT_STYLE: TextStyleState = {
  colorKey: '#000000',
  renderMode: 0,
  hScale: 100,
  charSpacing: 0,
  wordSpacing: 0,
  rise: 0,
};

export interface Fragment {
  readonly text: string;
  /** Text matrix in Page Space (PDF.js `transform`): its scale carries the font size. */
  readonly matrix: Matrix;
  /** Advance width along the baseline, in points. */
  readonly width: number;
  /** PDF.js font id; fragments in different fonts never merge. */
  readonly fontName: string;
  /** Em fractions; descent is negative. */
  readonly ascent: number;
  readonly descent: number;
  readonly vertical: boolean;
  readonly type3: boolean;
  readonly style: TextStyleState;
}

/** Fragment matrix expressed in Display space. */
export function displayMatrix(matrix: Matrix, geometry: PageGeometry): Matrix {
  return multiplyMatrix(pageToDisplayMatrix(geometry), matrix);
}

/**
 * Why a fragment cannot be edited in v1, or null. Skew is judged after removing the page rotation, so
 * horizontal text on a `/Rotate 90` page is not locked but a watermark rotated on the page is (D7).
 */
export function lockReason(fragment: Fragment, geometry: PageGeometry): LockReason | null {
  if (fragment.type3) return 'type3-font';
  if (fragment.vertical) return 'vertical-writing';
  const [a, b, c, d] = displayMatrix(fragment.matrix, geometry);
  const skewed = Math.abs(b) > MERGE.skewTolerance || Math.abs(c) > MERGE.skewTolerance;
  return skewed || a <= 0 || d >= 0 ? 'rotated-or-skewed' : null;
}

/** Axis-aligned Page Space box of the glyphs drawn by one fragment, including ascender and descender. */
export function fragmentBox(fragment: Fragment): Rect {
  const [a, b, c, d, e, f] = fragment.matrix;
  const length = Math.hypot(a, b) || 1;
  const ux = a / length;
  const uy = b / length;
  const width = Math.max(0, fragment.width);
  const xs: number[] = [];
  const ys: number[] = [];
  for (const along of [0, width]) {
    for (const em of [fragment.descent, fragment.ascent]) {
      xs.push(e + ux * along + c * em);
      ys.push(f + uy * along + d * em);
    }
  }
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

export function unionRects(rects: readonly Rect[]): Rect {
  const x0 = Math.min(...rects.map((r) => r.x));
  const y0 = Math.min(...rects.map((r) => r.y));
  const x1 = Math.max(...rects.map((r) => r.x + r.width));
  const y1 = Math.max(...rects.map((r) => r.y + r.height));
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

/** One Text Line before font and colour enrichment: merged fragments in left-to-right order. */
export interface Run<F extends Fragment = Fragment> {
  readonly fragments: readonly F[];
  readonly text: string;
  readonly lockReason: LockReason | null;
}

interface Placed<F extends Fragment> {
  readonly fragment: F;
  readonly x: number;
  readonly baseline: number;
  readonly size: number;
}

function placeInDisplay<F extends Fragment>(fragment: F, geometry: PageGeometry): Placed<F> {
  const [, , , d, e, f] = displayMatrix(fragment.matrix, geometry);
  return { fragment, x: e, baseline: f, size: Math.abs(d) };
}

const sameStyle = (a: TextStyleState, b: TextStyleState) =>
  a.colorKey === b.colorKey &&
  a.renderMode === b.renderMode &&
  a.hScale === b.hScale &&
  a.charSpacing === b.charSpacing &&
  a.wordSpacing === b.wordSpacing &&
  a.rise === b.rise;

function canMerge<F extends Fragment>(left: Placed<F>, right: Placed<F>): boolean {
  const l = left.fragment;
  const r = right.fragment;
  if (l.fontName !== r.fontName || !sameStyle(l.style, r.style)) return false;
  if (Math.abs(left.size - right.size) > MERGE.sizeTolerance) return false;
  if (Math.abs(left.baseline - right.baseline) >= MERGE.baselineTolerance * left.size) return false;
  const gap = right.x - (left.x + l.width);
  return Math.abs(gap) <= MERGE.maxGap * left.size;
}

/** Joins texts, inserting one space at a word-sized gap unless whitespace is already there (3.3). */
function joinText(left: string, right: string, gap: number, size: number): string {
  if (gap < MERGE.spaceGap * size || /\s$/.test(left) || /^\s/.test(right)) return left + right;
  return `${left} ${right}`;
}

/**
 * Merges fragments into runs. Locked fragments never merge (each is its own run). Two neighbours merge when
 * they share baseline, font, size and drawing state and the gap is at most 0.25 em (ADR-0002).
 */
export function mergeFragments<F extends Fragment>(fragments: readonly F[], geometry: PageGeometry): Run<F>[] {
  const runs: Run<F>[] = [];
  const free: Placed<F>[] = [];
  for (const fragment of fragments) {
    const reason = lockReason(fragment, geometry);
    if (reason) runs.push({ fragments: [fragment], text: fragment.text, lockReason: reason });
    else free.push(placeInDisplay(fragment, geometry));
  }

  // Rows by baseline (anchored on the row's first member), then left to right.
  const byBaseline = [...free].sort((p, q) => p.baseline - q.baseline || p.x - q.x);
  const rows: Placed<F>[][] = [];
  for (const placed of byBaseline) {
    const row = rows[rows.length - 1];
    const anchor = row?.[0];
    if (row && anchor && Math.abs(placed.baseline - anchor.baseline) < MERGE.baselineTolerance * anchor.size) row.push(placed);
    else rows.push([placed]);
  }

  for (const row of rows) {
    row.sort((p, q) => p.x - q.x);
    let current: Placed<F>[] = [];
    let text = '';
    const flush = () => {
      if (current.length) runs.push({ fragments: current.map((p) => p.fragment), text, lockReason: null });
      current = [];
    };
    for (const placed of row) {
      const last = current[current.length - 1];
      if (last && canMerge(last, placed)) {
        text = joinText(text, placed.fragment.text, placed.x - (last.x + last.fragment.width), last.size);
        current.push(placed);
      } else {
        flush();
        current = [placed];
        text = placed.fragment.text;
      }
    }
    flush();
  }
  return runs;
}

/** First fragment of a run: it carries the run's origin, matrix and style. */
export const runHead = <F extends Fragment>(run: Run<F>): F => {
  const head = run.fragments[0];
  if (!head) throw new Error('A run has at least one fragment');
  return head;
};

export function runBox(run: Run): Rect {
  return unionRects(run.fragments.map(fragmentBox));
}

/**
 * Top-to-bottom then left-to-right as displayed (D6). Runs whose baselines are within a third of the smaller
 * font size share a visual row.
 */
export function readingOrder<F extends Fragment>(runs: readonly Run<F>[], geometry: PageGeometry): Run<F>[] {
  const keyed = runs.map((run) => {
    const head = runHead(run);
    const [, , , d, e, f] = displayMatrix(head.matrix, geometry);
    if (run.lockReason === null) return { run, x: e, baseline: f, size: Math.abs(d) || 1 };
    // Locked (rotated) runs are ordered by the bottom-left of their displayed bounds.
    const box = pageRectToDisplay(geometry, runBox(run));
    return { run, x: box.x, baseline: box.y + box.height, size: Math.abs(d) || 1 };
  });
  keyed.sort((p, q) => p.baseline - q.baseline);
  const rows: (typeof keyed)[] = [];
  for (const item of keyed) {
    const row = rows[rows.length - 1];
    const prev = row?.[row.length - 1];
    if (row && prev && Math.abs(item.baseline - prev.baseline) < Math.min(prev.size, item.size) / 3) row.push(item);
    else rows.push([item]);
  }
  return rows.flatMap((row) => row.sort((p, q) => p.x - q.x).map((item) => item.run));
}

export const lineId = (pageIndex: number, sequence: number): string => `${pageIndex}:${sequence}`;
