import { describe, expect, it } from 'vitest';
import { layoutText, detectOverlap } from '../../src/lib/text-layout';
import type { TextStyle } from '../../src/types/operations';
import type { LayoutLine, BoxLike } from '../../src/lib/text-layout';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STYLE: TextStyle = {
  fontClass: 'sans',
  bold: false,
  italic: false,
  fontFamilyOverride: null,
  size: 12,
  color: '#000000',
  charSpacing: 0,
  wordSpacing: 0,
  lineHeight: 1.2,
  hScale: 100,
  rise: 0,
  renderMode: 0,
};

const ORIGIN = { x: 10, y: 700, width: 200, height: 14 };

// Fixed-width advance: each char is exactly `size` wide so math is easy
function fixedAdvance(ch: string, style: TextStyle): number {
  return ch === ' ' ? style.size * 0.3 : style.size;
}

// ─── layoutText ───────────────────────────────────────────────────────────────

describe('layoutText', () => {
  it('single line no wrap', () => {
    const { lines } = layoutText('Hello', STYLE, ORIGIN, 600, fixedAdvance);
    expect(lines).toHaveLength(1);
    expect(lines.at(0)?.text).toBe('Hello');
    expect(lines.at(0)?.x).toBe(10);
    expect(lines.at(0)?.y).toBe(700);
  });

  it('wraps at pageWidth − 40', () => {
    // pageWidth=100, wrapMargin=60, originX=10 → maxWidth=50
    // Each char=12, so 4 chars = 48 < 50, 5 chars = 60 > 50
    // 'ABCD EFG' → first word ABCD=48 fits, space+EFG=3.6+36=39.6 total=87.6>50 → wrap
    const { lines } = layoutText('ABCD EFG', STYLE, ORIGIN, 100, fixedAdvance);
    expect(lines.length).toBeGreaterThanOrEqual(2);
    expect(lines.at(0)?.text).toBe('ABCD');
    expect(lines.at(1)?.text).toBe('EFG');
  });

  it('y decreases by size × lineHeight per line', () => {
    const { lines } = layoutText('A B', STYLE, { ...ORIGIN, x: 10 }, 30, fixedAdvance);
    // pageWidth=30, maxWidth=30-40 negative or zero → each word on own line
    expect(lines.length).toBeGreaterThanOrEqual(2);
    const step = STYLE.size * STYLE.lineHeight;
    expect(lines.at(1)?.y).toBe((lines.at(0)?.y ?? 0) - step);
  });

  it('empty text returns one blank line', () => {
    const { lines } = layoutText('', STYLE, ORIGIN, 600, fixedAdvance);
    expect(lines).toHaveLength(1);
    expect(lines.at(0)?.text).toBe('');
  });

  it('multi-wrap produces correct order', () => {
    // pageWidth=120, wrapMargin=80, originX=10, maxWidth=70, chars=12 each
    // 'AA BB CC' → AA(24)+space(3.6)+BB(24)=51.6 < 70, +space+CC=51.6+3.6+24=79.2>70 → wrap at CC
    const { lines } = layoutText('AA BB CC', STYLE, ORIGIN, 120, fixedAdvance);
    expect(lines.length).toBe(2);
    expect(lines.at(0)?.text).toBe('AA BB');
    expect(lines.at(1)?.text).toBe('CC');
  });

  it('exact-width-no-wrap boundary: text that fills exactly maxWidth stays on one line', () => {
    // pageWidth=82, wrapMargin=42, originX=10, maxWidth=32
    // 'AB' = 2 chars × 12 = 24 < 32, 'CD' = 24, 'AB CD' = 24+3.6+24=51.6 > 32 → wraps
    // 'AB' alone = 24 ≤ 32 → stays on own line
    const { lines } = layoutText('AB', STYLE, ORIGIN, 82, fixedAdvance);
    expect(lines).toHaveLength(1);
    expect(lines.at(0)?.text).toBe('AB');
  });

  it('newlines in text split into paragraphs', () => {
    const { lines } = layoutText('Hello\nWorld', STYLE, ORIGIN, 600, fixedAdvance);
    expect(lines).toHaveLength(2);
    expect(lines.at(0)?.text).toBe('Hello');
    expect(lines.at(1)?.text).toBe('World');
  });
});

// ─── detectOverlap ────────────────────────────────────────────────────────────

describe('detectOverlap', () => {
  const patch: LayoutLine = { text: 'hi', x: 50, y: 100, width: 40 };

  it('no overlap returns false', () => {
    const other: BoxLike[] = [{ x: 200, y: 200, width: 50, height: 14 }];
    expect(detectOverlap([patch], other, 14)).toBe(false);
  });

  it('overlapping returns true', () => {
    const other: BoxLike[] = [{ x: 60, y: 95, width: 50, height: 14 }];
    expect(detectOverlap([patch], other, 14)).toBe(true);
  });

  it('deleted lines are excluded', () => {
    const other: BoxLike[] = [{ x: 60, y: 95, width: 50, height: 14, deleted: true }];
    expect(detectOverlap([patch], other, 14)).toBe(false);
  });

  it('empty patchLines returns false', () => {
    const other: BoxLike[] = [{ x: 60, y: 95, width: 50, height: 14 }];
    expect(detectOverlap([], other, 14)).toBe(false);
  });
});
