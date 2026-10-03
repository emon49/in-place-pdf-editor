import { OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { describe, expect, it } from 'vitest';
import { correlateSpans, walkOperatorList, UNRESOLVED_COLOR, type StyledSpan } from '../../src/lib/content-stream-state';
import { sampleGlyphColor, sampleRing, UNIFORM_RATIO, type Raster } from '../../src/lib/pdf-color-extractor';
import { DEFAULT_STYLE, type Fragment } from '../../src/lib/text-geometry';

type Op = [number, unknown[]];
const list = (ops: Op[]) => ({ fnArray: ops.map(([fn]) => fn), argsArray: ops.map(([, args]) => args) });
const glyphs = (n: number, width = 500) => [Array.from({ length: n }, () => ({ width }))];
// PDF.js passes the matrix as a single array operand.
const tm = (x: number, y: number): Op => [OPS.setTextMatrix, [[1, 0, 0, 1, x, y]]];
const show = (n = 3): Op => [OPS.showText, glyphs(n)];

describe('operator-list state walker (5.1)', () => {
  it('reads an RGB fill colour', () => {
    const [span] = walkOperatorList(list([[OPS.setFillRGBColor, ['#cc1a1a']], [OPS.setFont, ['f1', 12]], tm(72, 700), show()]));
    expect(span?.color).toBe('#CC1A1A');
    expect(span).toMatchObject({ x: 72, y: 700, fontName: 'f1', fontSize: 12 });
  });

  it('reads grey and CMYK fills', () => {
    const grey = walkOperatorList(list([[OPS.setFillGray, [0]], [OPS.setFont, ['f1', 12]], tm(0, 0), show()]));
    expect(grey[0]?.color).toBe('#000000');
    const cmyk = walkOperatorList(list([[OPS.setFillCMYKColor, [0, 1, 1, 0]], [OPS.setFont, ['f1', 12]], tm(0, 0), show()]));
    expect(cmyk[0]?.color).toBe('#FF0000');
  });

  it('keeps a colour across several show operations until it changes', () => {
    const spans = walkOperatorList(
      list([
        [OPS.setFont, ['f1', 12]],
        [OPS.setFillRGBColor, ['#112233']],
        tm(10, 100), show(),
        tm(10, 80), show(),
        tm(10, 60), show(),
        [OPS.setFillRGBColor, ['#445566']],
        tm(10, 40), show(),
      ]),
    );
    expect(spans.map((s) => s.color)).toEqual(['#112233', '#112233', '#112233', '#445566']);
  });

  it('restores the colour and text state at the end of a save/restore pair, including nesting', () => {
    const spans = walkOperatorList(
      list([
        [OPS.setFont, ['f1', 12]],
        [OPS.setFillRGBColor, ['#000001']],
        [OPS.save, []],
        [OPS.setFillRGBColor, ['#000002']],
        [OPS.setCharSpacing, [1.5]],
        [OPS.save, []],
        [OPS.setFillRGBColor, ['#000003']],
        tm(0, 30), show(),
        [OPS.restore, []],
        tm(0, 20), show(),
        [OPS.restore, []],
        tm(0, 10), show(),
      ]),
    );
    expect(spans.map((s) => s.color)).toEqual(['#000003', '#000002', '#000001']);
    expect(spans.map((s) => s.charSpacing)).toEqual([1.5, 1.5, 0]);
  });

  it('records spacing, scaling, rise and rendering mode, with documented defaults', () => {
    const [plain] = walkOperatorList(list([[OPS.setFont, ['f1', 12]], tm(0, 0), show()]));
    expect(plain).toMatchObject({ charSpacing: 0, wordSpacing: 0, hScale: 100, rise: 0, renderMode: 0 });
    const [set] = walkOperatorList(
      list([
        [OPS.setFont, ['f1', 12]],
        [OPS.setCharSpacing, [1.5]],
        [OPS.setWordSpacing, [2]],
        [OPS.setHScale, [90]],
        [OPS.setTextRise, [3]],
        [OPS.setTextRenderingMode, [2]],
        tm(0, 0), show(),
      ]),
    );
    expect(set).toMatchObject({ charSpacing: 1.5, wordSpacing: 2, hScale: 90, rise: 3, renderMode: 2 });
  });

  it('marks pattern fills unresolved', () => {
    const [span] = walkOperatorList(list([[OPS.setFillColorN, ['TilingPattern', 'P1']], [OPS.setFont, ['f1', 12]], tm(0, 0), show()]));
    expect(span?.color).toBeNull();
  });

  it('applies the CTM and rise to the start point', () => {
    const [span] = walkOperatorList(
      list([[OPS.transform, [2, 0, 0, 2, 10, 20]], [OPS.setFont, ['f1', 12]], [OPS.setTextRise, [1]], tm(5, 6), show()]),
    );
    expect(span).toMatchObject({ x: 20, y: 34 });
  });

  it('advances the text matrix so a second show without repositioning starts after the first', () => {
    const spans = walkOperatorList(list([[OPS.setFont, ['f1', 10]], tm(100, 50), [OPS.showText, glyphs(4, 500)], [OPS.showText, glyphs(1)]]));
    expect(spans[1]?.x).toBeCloseTo(100 + 4 * 5);
  });

  it('accepts flat matrix operands too', () => {
    const [span] = walkOperatorList(list([[OPS.setFont, ['f1', 10]], [OPS.setTextMatrix, [1, 0, 0, 1, 7, 8]], show()]));
    expect([span?.x, span?.y]).toEqual([7, 8]);
  });

  it('moves lines with Td and T*', () => {
    const spans = walkOperatorList(
      list([[OPS.setFont, ['f1', 10]], [OPS.beginText, []], [OPS.moveText, [72, 700]], show(), [OPS.setLeading, [14]], [OPS.nextLine, []], show()]),
    );
    expect(spans.map((s) => [s.x, s.y])).toEqual([[72, 700], [72, 686]]);
  });

  it('treats form XObject begin/end as a save with a transform', () => {
    const spans = walkOperatorList(
      list([[OPS.setFont, ['f1', 10]], [OPS.paintFormXObjectBegin, [[1, 0, 0, 1, 50, 0]]], tm(0, 10), show(), [OPS.paintFormXObjectEnd, []], tm(0, 10), show()]),
    );
    expect(spans.map((s) => s.x)).toEqual([50, 0]);
  });
});

const fragment = (x: number, y: number, font = 'f1'): Fragment => ({
  text: 'x', matrix: [12, 0, 0, 12, x, y], width: 10, fontName: font, ascent: 0.9, descent: -0.2, vertical: false, type3: false, style: DEFAULT_STYLE,
});
const span = (x: number, y: number, color: string | null, font = 'f1'): StyledSpan => ({
  x, y, fontName: font, fontSize: 12, color, renderMode: 0, hScale: 100, charSpacing: 0, wordSpacing: 0, rise: 0,
});

describe('span-to-item correlation (5.2)', () => {
  it('matches exactly by start point and font', () => {
    const [a, b] = correlateSpans([fragment(10, 100), fragment(10, 80)], [span(10, 80, '#222222'), span(10, 100, '#111111')]);
    expect([a?.style.colorKey, a?.match, b?.style.colorKey, b?.match]).toEqual(['#111111', 'exact', '#222222', 'exact']);
  });

  it('falls back to the nearest span within half an em in the same font', () => {
    const [a] = correlateSpans([fragment(10, 100)], [span(12, 100, '#111111'), span(10, 100, '#999999', 'other')]);
    expect(a).toMatchObject({ match: 'nearest', colorResolved: true });
    expect(a?.style.colorKey).toBe('#111111');
  });

  it('falls back to the next unconsumed span in stream order', () => {
    const [a] = correlateSpans([fragment(300, 300)], [span(10, 100, '#111111')]);
    expect(a).toMatchObject({ match: 'sequence', colorResolved: true });
  });

  it('marks an item that matches nothing colour-unresolved (forced mismatch)', () => {
    const [a] = correlateSpans([fragment(10, 100, 'f9')], [span(10, 100, '#111111')]);
    expect(a).toMatchObject({ match: 'none', colorResolved: false });
    expect(a?.style.colorKey).toBe(UNRESOLVED_COLOR);
  });

  it('drops whitespace placeholders that start no show operation but keeps real spaces', () => {
    const space = (x: number): Fragment => ({ ...fragment(x, 100), text: ' ' });
    const out = correlateSpans([fragment(10, 100), space(40), space(60)], [span(10, 100, '#111111'), span(60, 100, '#111111')]);
    expect(out.map((f) => f.text)).toEqual(['x', ' ']);
  });

  it('marks a pattern-filled item unresolved while still matching it', () => {
    const [a] = correlateSpans([fragment(10, 100)], [span(10, 100, null)]);
    expect(a).toMatchObject({ match: 'exact', colorResolved: false });
  });
});

/** Solid-colour raster with optional painted rectangles. */
function raster(width: number, height: number, fill: [number, number, number], paint: (x: number, y: number) => [number, number, number] | null = () => null): Raster {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = paint(x, y) ?? fill;
      data.set([r, g, b, 255], (y * width + x) * 4);
    }
  }
  return { width, height, data };
}
const rect = { x: 20, y: 20, width: 40, height: 12 };

describe('pixel sampling (5.3, 6.2)', () => {
  it('samples the glyph colour of text drawn in red on white', () => {
    const r = raster(100, 60, [255, 255, 255], (x, y) => (x >= 24 && x < 56 && y >= 22 && y < 30 && (x + y) % 2 === 0 ? [204, 26, 26] : null));
    expect(sampleGlyphColor(r, rect)).toBe('#CC1A1A');
  });

  it('finds no ink on an empty area', () => {
    expect(sampleGlyphColor(raster(100, 60, [255, 255, 255]), rect)).toBeNull();
  });

  it('reports a white page as a uniform white background', () => {
    expect(sampleRing(raster(100, 60, [255, 255, 255]), rect)).toMatchObject({ color: '#FFFFFF', uniform: true, ratio: 1 });
  });

  it('reports a tinted header as its tint, uniform', () => {
    const tint: [number, number, number] = [219, 232, 250];
    const r = raster(100, 60, [255, 255, 255], (_x, y) => (y >= 10 && y < 45 ? tint : null));
    const sample = sampleRing(r, rect);
    expect(sample?.uniform).toBe(true);
    expect(sample?.color).toBe('#DBE8FA');
  });

  it('reports a photographic ring as non-uniform while still giving a dominant colour', () => {
    const r = raster(100, 60, [0, 0, 0], (x, y) => [(x * 37 + y * 11) % 256, (x * 13 + y * 71) % 256, (x * 91 + y * 29) % 256]);
    const sample = sampleRing(r, rect);
    expect(sample?.uniform).toBe(false);
    expect(sample?.ratio).toBeLessThan(UNIFORM_RATIO);
    expect(sample?.color).toMatch(/^#[0-9A-F]{6}$/);
  });

  it('excludes the line box itself from the ring', () => {
    const r = raster(100, 60, [255, 255, 255], (x, y) => (x >= 20 && x < 60 && y >= 20 && y < 32 ? [0, 0, 0] : null));
    expect(sampleRing(r, rect)?.color).toBe('#FFFFFF');
  });

  it('clips a ring that runs off the raster and returns null when entirely outside', () => {
    expect(sampleRing(raster(100, 60, [255, 255, 255]), { x: 0, y: 0, width: 20, height: 10 })?.uniform).toBe(true);
    expect(sampleRing(raster(10, 10, [255, 255, 255]), { x: 500, y: 500, width: 5, height: 5 })).toBeNull();
  });
});
