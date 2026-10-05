import { describe, expect, it } from 'vitest';
import { fontSizeFromMatrix, horizontalScalingFromMatrix, lineHeight } from '../../src/lib/font-style-extractor';
import { identifyFont, parseFontName } from '../../src/lib/font-resolver';
import { embeddingPermission, readCmapCodePoints, readFsType, readSfntTables } from '../../src/lib/sfnt';
import { parseToUnicode } from '../../src/lib/to-unicode';

describe('font metrics (4.1)', () => {
  it('reports the true size of horizontally compressed text', () => {
    expect(fontSizeFromMatrix([6, 0, 0, 12, 0, 0])).toBe(12);
    expect(horizontalScalingFromMatrix([6, 0, 0, 12, 0, 0])).toBe(50);
  });
  it('reads a plain matrix', () => {
    expect(fontSizeFromMatrix([11, 0, 0, 11, 72, 670])).toBe(11);
    expect(horizontalScalingFromMatrix([11, 0, 0, 11, 72, 670])).toBe(100);
  });
  it('uses the full vertical scale for a skewed matrix', () => {
    expect(fontSizeFromMatrix([12, 0, 3, 4, 0, 0])).toBe(5);
  });
  it('derives line height ratio from ascent and descent', () => {
    expect(lineHeight(0.9, -0.2)).toBeCloseTo(1.1);
  });
});

describe('family normalization and class (4.2)', () => {
  it('strips a classic subset prefix', () => {
    const f = identifyFont('BWODTG+Times-Bold');
    expect(f).toMatchObject({ family: 'Times', subsetPrefix: 'BWODTG', bold: true, fontClass: 'serif' });
  });
  it('strips a PostScript suffix and spaces the family', () => {
    expect(parseFontName('TimesNewRomanPSMT').family).toBe('Times New Roman');
    expect(parseFontName('Arial-BoldMT').family).toBe('Arial');
    expect(identifyFont('Arial-BoldMT').bold).toBe(true);
  });
  it('strips a numeric subset suffix and a style suffix', () => {
    expect(parseFontName('LiberationSans-Bold-2000').family).toBe('Liberation Sans');
    expect(identifyFont('LiberationSans-Bold-2000').bold).toBe(true);
  });
  it('handles comma styles and glued styles', () => {
    expect(parseFontName('Arial,Bold').family).toBe('Arial');
    expect(identifyFont('ArialBold').family).toBe('Arial');
    expect(identifyFont('Helvetica-BoldOblique')).toMatchObject({ family: 'Helvetica', bold: true, italic: true });
  });
  it('keeps protected compounds together', () => {
    expect(parseFontName('DejaVuSans').family).toBe('DejaVu Sans');
  });
  it('takes serif and italic from the descriptor', () => {
    const f = identifyFont('QWERTY+Mystery', { flags: 2, italicAngle: -12, weight: null });
    expect(f).toMatchObject({ fontClass: 'serif', italic: true });
  });
  it('takes mono from the fixed-pitch flag even when the name says nothing', () => {
    expect(identifyFont('ABCDEF+Opaque', { flags: 1, italicAngle: 0, weight: null }).fontClass).toBe('mono');
  });
  it('trusts a descriptor without the serif flag over a serif-looking name', () => {
    expect(identifyFont('Times-Roman', { flags: 32, italicAngle: 0, weight: 400 }).fontClass).toBe('sans');
  });
  it('reads weight from the descriptor', () => {
    expect(identifyFont('ABCDEF+Opaque', { flags: 32, italicAngle: 0, weight: 700 }).bold).toBe(true);
    expect(identifyFont('ABCDEF+Opaque', { flags: 32 | (1 << 18), italicAngle: 0, weight: null }).bold).toBe(true);
  });
  it('falls back to the name when there is no descriptor', () => {
    expect(identifyFont('Helvetica-Bold')).toMatchObject({ bold: true, fontClass: 'sans', italic: false });
    expect(identifyFont('Courier-Oblique')).toMatchObject({ fontClass: 'mono', italic: true });
    expect(identifyFont('Times-Roman').fontClass).toBe('serif');
  });
});

/** Builds a minimal sfnt with the given tables. */
function sfnt(tables: Record<string, Uint8Array>): Uint8Array {
  const tags = Object.keys(tables);
  let offset = 12 + tags.length * 16;
  const total = tags.reduce((n, t) => n + (tables[t]?.length ?? 0), offset);
  const out = new Uint8Array(total);
  const v = new DataView(out.buffer);
  v.setUint32(0, 0x00010000);
  v.setUint16(4, tags.length);
  tags.forEach((tag, i) => {
    const data = tables[tag] ?? new Uint8Array();
    for (let k = 0; k < 4; k++) out[12 + i * 16 + k] = tag.charCodeAt(k);
    v.setUint32(12 + i * 16 + 8, offset);
    v.setUint32(12 + i * 16 + 12, data.length);
    out.set(data, offset);
    offset += data.length;
  });
  return out;
}
const os2 = (fsType: number) => {
  const t = new Uint8Array(78);
  new DataView(t.buffer).setUint16(8, fsType);
  return t;
};

describe('sfnt reader (4.4)', () => {
  it('reports an installable flag as editable', () => {
    const font = sfnt({ 'OS/2': os2(0), head: new Uint8Array(4) });
    expect(readFsType(font)).toBe(0);
    expect(embeddingPermission(0)).toEqual({ editable: true, restriction: null });
  });
  it('reports preview-and-print as not editable and names it', () => {
    const font = sfnt({ 'OS/2': os2(4) });
    expect(embeddingPermission(readFsType(font))).toEqual({ editable: false, restriction: 'preview-and-print' });
  });
  it('reports restricted licence', () => {
    expect(embeddingPermission(2)).toEqual({ editable: false, restriction: 'restricted licence' });
  });
  it('reports editable embedding', () => {
    expect(embeddingPermission(8).editable).toBe(true);
  });
  it('treats a program with no OS/2 table as permitting editing', () => {
    const font = sfnt({ head: new Uint8Array(4), glyf: new Uint8Array(4) });
    expect(readFsType(font)).toBeNull();
    expect(embeddingPermission(readFsType(font))).toEqual({ editable: true, restriction: null });
  });
  it('rejects truncated data', () => {
    expect(() => readSfntTables(new Uint8Array(5))).toThrow();
    expect(() => readSfntTables(sfnt({ head: new Uint8Array(40) }).subarray(0, 60))).toThrow();
  });
  it('reads a format 4 cmap', () => {
    // One segment A..C plus the terminating 0xFFFF segment.
    const t = new Uint8Array(4 + 8 + 16 + 2 + 8 * 2 + 4 * 2);
    const v = new DataView(t.buffer);
    v.setUint16(2, 1); // one encoding record
    v.setUint16(4, 3);
    v.setUint16(6, 1);
    v.setUint32(8, 12);
    const sub = 12;
    v.setUint16(sub, 4);
    v.setUint16(sub + 6, 4); // segCountX2
    const ends = sub + 14;
    v.setUint16(ends, 0x43);
    v.setUint16(ends + 2, 0xffff);
    const starts = ends + 4 + 2;
    v.setUint16(starts, 0x41);
    v.setUint16(starts + 2, 0xffff);
    const points = readCmapCodePoints(sfnt({ cmap: t }));
    expect([...(points ?? [])].sort()).toEqual([0x41, 0x42, 0x43]);
  });
  it('returns null when there is no cmap', () => {
    expect(readCmapCodePoints(sfnt({ head: new Uint8Array(4) }))).toBeNull();
  });
});

describe('ToUnicode parsing (4.5)', () => {
  it('reads bfchar and bfrange entries', () => {
    const cmap = `
      3 beginbfchar <01> <0041> <02> <0062> <03> <FB01> endbfchar
      2 beginbfrange <10> <12> <0061> <20> <21> [<0058> <0059>] endbfrange`;
    expect([...parseToUnicode(cmap)].sort()).toEqual(['A', 'X', 'Y', 'a', 'b', 'c', '\uFB01']);
  });
  it('skips multi-character targets such as ligature expansions', () => {
    expect([...parseToUnicode('1 beginbfchar <01> <00660069> endbfchar')]).toEqual([]);
  });
});
