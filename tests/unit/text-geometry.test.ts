import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createPageGeometry } from '../../src/lib/coordinates';
import {
  DEFAULT_STYLE,
  fragmentBox,
  lineId,
  lockReason,
  mergeFragments,
  readingOrder,
  runBox,
  type Fragment,
} from '../../src/lib/text-geometry';

const upright = createPageGeometry([0, 0, 612, 792], 0);
const rotated = createPageGeometry([0, 0, 612, 792], 90);

interface Opts {
  font?: string;
  size?: number;
  color?: string;
  y?: number;
}
/** An upright fragment starting at page x, baseline y, `width` wide. */
function frag(text: string, x: number, width: number, o: Opts = {}): Fragment {
  const size = o.size ?? 12;
  return {
    text,
    matrix: [size, 0, 0, size, x, o.y ?? 700],
    width,
    fontName: o.font ?? 'f1',
    ascent: 0.9,
    descent: -0.2,
    vertical: false,
    type3: false,
    style: { ...DEFAULT_STYLE, colorKey: o.color ?? '#000000' },
  };
}

describe('mergeFragments (3.2, 3.3)', () => {
  it('merges a sentence split into three fragments into one line', () => {
    const runs = mergeFragments([frag('Total', 72, 26), frag('amount', 100.5, 38), frag('due', 141, 20)], upright);
    expect(runs.map((r) => r.text)).toEqual(['Total amount due']);
  });

  it('keeps table cells separate', () => {
    const cells = [
      frag('Design consultation (hours)', 54, 130, { size: 10 }),
      frag('6', 340, 5, { size: 10 }),
      frag('$85.00', 420, 30, { size: 10 }),
      frag('$510.00', 500, 35, { size: 10 }),
    ];
    expect(mergeFragments(cells, upright).map((r) => r.text)).toEqual(cells.map((c) => c.text));
  });

  it('splits a line where the font changes', () => {
    const runs = mergeFragments([frag('Total:', 72, 30, { font: 'bold' }), frag('$510.00', 104, 40)], upright);
    expect(runs.map((r) => r.text).sort()).toEqual(['$510.00', 'Total:']);
  });

  it('splits where the colour, size or baseline differ', () => {
    expect(mergeFragments([frag('a', 72, 6), frag('b', 78, 6, { color: '#ff0000' })], upright)).toHaveLength(2);
    expect(mergeFragments([frag('a', 72, 6), frag('b', 78, 6, { size: 14 })], upright)).toHaveLength(2);
    expect(mergeFragments([frag('a', 72, 6), frag('b', 78, 6, { y: 695 })], upright)).toHaveLength(2);
  });

  it('merges at the 0.25 em limit and not beyond', () => {
    expect(mergeFragments([frag('a', 72, 6), frag('b', 81, 6)], upright)).toHaveLength(1); // gap 3 = 0.25 em
    expect(mergeFragments([frag('a', 72, 6), frag('b', 81.1, 6)], upright)).toHaveLength(2);
  });

  it('tolerates a small baseline difference', () => {
    expect(mergeFragments([frag('a', 72, 6), frag('b', 78, 6, { y: 698 })], upright)).toHaveLength(1); // 2 < 0.2 em
  });

  it('inserts a space at a word-sized gap with no space character', () => {
    const [run] = mergeFragments([frag('Hello', 72, 28), frag('world', 103, 30)], upright); // gap 3 pt
    expect(run?.text).toBe('Hello world');
  });

  it('joins kerned fragments without a space', () => {
    const [run] = mergeFragments([frag('A', 72, 8), frag('V', 80.5, 8)], upright); // gap 0.5 pt < 0.96
    expect(run?.text).toBe('AV');
  });

  it('does not double a space that is already present', () => {
    expect(mergeFragments([frag('Hello ', 72, 31), frag('world', 104, 30)], upright)[0]?.text).toBe('Hello world');
    expect(mergeFragments([frag('Hello', 72, 28), frag(' world', 102, 33)], upright)[0]?.text).toBe('Hello world');
  });

  it('merges in fragment order regardless of input order', () => {
    const runs = mergeFragments([frag('world', 103, 30), frag('Hello', 72, 28)], upright);
    expect(runs[0]?.text).toBe('Hello world');
  });

  it('merges along the displayed line on a /Rotate 90 page', () => {
    // Displayed horizontal text on a /Rotate 90 page: baseline runs along page +y.
    const r = (text: string, y: number, width: number): Fragment => ({
      ...frag(text, 0, width),
      matrix: [0, 12, -12, 0, 100, y],
    });
    const runs = mergeFragments([r('Hello', 100, 28), r('world', 131, 30)], rotated);
    expect(runs.map((x) => x.text)).toEqual(['Hello world']);
    expect(runs[0]?.lockReason).toBeNull();
  });
});

describe('lockReason (3.5)', () => {
  it('locks a run rotated on an unrotated page', () => {
    const c = Math.cos(Math.PI / 6) * 54;
    const s = Math.sin(Math.PI / 6) * 54;
    const watermark: Fragment = { ...frag('DRAFT', 190, 200), matrix: [c, s, -s, c, 190, 330] };
    expect(lockReason(watermark, upright)).toBe('rotated-or-skewed');
  });

  it('does not lock horizontal text on a /Rotate 90 page', () => {
    expect(lockReason({ ...frag('Hi', 0, 10), matrix: [0, 12, -12, 0, 100, 100] }, rotated)).toBeNull();
  });

  it('locks text that is upright on the page but sideways once displayed', () => {
    expect(lockReason(frag('Hi', 72, 10), rotated)).toBe('rotated-or-skewed');
  });

  it('locks vertical writing and Type 3 fonts', () => {
    expect(lockReason({ ...frag('Hi', 72, 10), vertical: true }, upright)).toBe('vertical-writing');
    expect(lockReason({ ...frag('Hi', 72, 10), type3: true }, upright)).toBe('type3-font');
  });

  it('locks mirrored text', () => {
    expect(lockReason({ ...frag('Hi', 72, 10), matrix: [-12, 0, 0, 12, 72, 700] }, upright)).not.toBeNull();
  });

  it('never merges locked fragments', () => {
    const a: Fragment = { ...frag('a', 72, 6), vertical: true };
    const b: Fragment = { ...frag('b', 78, 6), vertical: true };
    const runs = mergeFragments([a, b], upright);
    expect(runs).toHaveLength(2);
    expect(runs.every((r) => r.lockReason === 'vertical-writing')).toBe(true);
  });
});

describe('geometry (3.4)', () => {
  it('boxes a 12 pt line at (72, 700), 142 wide', () => {
    const box = fragmentBox(frag('x', 72, 142));
    expect(box.x).toBeCloseTo(72);
    expect(box.width).toBeCloseTo(142);
    expect(box.y).toBeCloseTo(700 - 0.2 * 12);
    expect(box.y + box.height).toBeCloseTo(700 + 0.9 * 12);
  });

  it('unions the boxes of merged fragments', () => {
    const run = mergeFragments([frag('Hello', 72, 28), frag('world', 103, 30)], upright)[0];
    if (!run) throw new Error('no run');
    const box = runBox(run);
    expect(box.x).toBeCloseTo(72);
    expect(box.width).toBeCloseTo(61);
  });

  it('property: boxes never have negative extents', () => {
    const num = fc.double({ min: -500, max: 500, noNaN: true });
    fc.assert(
      fc.property(num, num, num, num, num, num, fc.double({ min: -50, max: 400, noNaN: true }), (a, b, c, d, e, f, w) => {
        const box = fragmentBox({ ...frag('x', 0, w), matrix: [a, b, c, d, e, f] });
        expect(box.width).toBeGreaterThanOrEqual(0);
        expect(box.height).toBeGreaterThanOrEqual(0);
      }),
    );
  });
});

describe('reading order and identity (3.6)', () => {
  it('orders top to bottom, then left to right', () => {
    const runs = mergeFragments(
      [frag('bottom', 72, 40, { y: 100 }), frag('right', 400, 30, { y: 700 }), frag('left', 72, 30, { y: 700 })],
      upright,
    );
    expect(readingOrder(runs, upright).map((r) => r.text)).toEqual(['left', 'right', 'bottom']);
  });

  it('orders by the displayed layout on a rotated page', () => {
    // Display y = page x on /Rotate 90: the heading (page x = 50) is above the table row (page x = 120).
    const r = (text: string, x: number, y: number, width: number): Fragment => ({
      ...frag(text, 0, width),
      matrix: [0, 12, -12, 0, x, y],
    });
    const heading = r('Heading', 50, 100, 60);
    const cellA = r('A', 120, 100, 8);
    const cellB = r('B', 120, 300, 8);
    const ordered = readingOrder(mergeFragments([cellB, cellA, heading], rotated), rotated);
    expect(ordered.map((x) => x.text)).toEqual(['Heading', 'A', 'B']);
  });

  it('orders a locked run by its displayed position', () => {
    const c = Math.cos(Math.PI / 6) * 20;
    const s = Math.sin(Math.PI / 6) * 20;
    const slanted: Fragment = { ...frag('Slanted', 300, 60), matrix: [c, s, -s, c, 300, 400] };
    const ordered = readingOrder(mergeFragments([frag('low', 72, 20, { y: 100 }), slanted, frag('top', 72, 20, { y: 700 })], upright), upright);
    expect(ordered.map((x) => x.text)).toEqual(['top', 'Slanted', 'low']);
  });

  it('builds identifiers from page and sequence', () => {
    expect(lineId(2, 7)).toBe('2:7');
  });
});
