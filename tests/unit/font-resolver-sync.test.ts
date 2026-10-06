import { describe, expect, it } from 'vitest';
import { browserFaceOf, charCodesOf } from '../../src/lib/browser-face';
import { encodeText } from '../../src/lib/font-encoder';
import { patchFont, resolveFontSync, type FontResolutionInput } from '../../src/lib/font-resolver';
import type { FontFacts } from '../../src/types/page-model';

const EDITABLE = { fsType: 0, editable: true, restriction: null };
const pua = (...codes: number[]) => String.fromCodePoint(...codes);

/** An embedded WinAnsi subset that PDF.js registered with glyphs moved to the Private Use Area. */
function embeddedFont(chars: string, overrides: Partial<FontFacts> = {}): FontFacts {
  const glyphMap = new Map<number, number>();
  [...chars].forEach((ch, i) => glyphMap.set(ch.codePointAt(0) as number, 0xe000 + i));
  return {
    rawName: 'ABCDEF+Times-Italic',
    subtype: 'TrueType',
    embedding: null,
    licence: EDITABLE,
    encoding: { kind: 'simple', name: 'WinAnsiEncoding' },
    coverage: new Set(chars),
    face: { family: '"g_d0_f3", serif', glyphMap },
    ...overrides,
  };
}

function input(font: FontFacts, family: string, fontClass: FontResolutionInput['fontClass'], override: string | null = null): FontResolutionInput {
  return { font, fontRef: 'g_d0_f3', family, fontClass, fontFamilyOverride: override };
}

describe('resolveFontSync (ADR-0007)', () => {
  it('uses the original font when it can draw every character', () => {
    const rf = resolveFontSync(input(embeddedFont('The. Example'), 'Times', 'serif'), 'The. Example');
    expect(rf).toMatchObject({ tier: 1, loadedName: 'g_d0_f3' });
  });

  it('ignores newlines when checking the original font', () => {
    expect(resolveFontSync(input(embeddedFont('Hi yo'), 'Times', 'serif'), 'Hi\nyo').tier).toBe(1);
  });

  it('leaves the original font when a character is missing from the subset', () => {
    const rf = resolveFontSync(input(embeddedFont('The'), 'Times', 'serif'), 'Thx');
    expect(rf).toMatchObject({ tier: 3, cssFamily: 'Liberation Serif' });
  });

  it('leaves the original font when PDF.js has no face to preview it with', () => {
    const font = embeddedFont('The', { face: undefined });
    expect(resolveFontSync(input(font, 'Times', 'serif'), 'The').tier).not.toBe(1);
  });

  it('leaves the original font when its licence forbids editing', () => {
    const font = embeddedFont('The', { licence: { fsType: 2, editable: false, restriction: 'Restricted' } });
    expect(resolveFontSync(input(font, 'Times', 'serif'), 'The').tier).not.toBe(1);
  });

  it.each([
    ['Arial', 'sans', 'Liberation Sans'],
    ['Times New Roman', 'serif', 'Liberation Serif'],
    ['Courier New', 'mono', 'Liberation Mono'],
    ['Calibri', 'sans', 'Carlito'],
    ['Georgia', 'serif', 'Gelasio'],
  ] as const)('maps %s to its metric-compatible substitute', (family, fontClass, expected) => {
    const rf = resolveFontSync(input(embeddedFont(''), family, fontClass), 'Ω');
    expect(rf).toMatchObject({ tier: 3, cssFamily: expected });
  });

  it('uses a catalog family directly when the document font is one', () => {
    expect(resolveFontSync(input(embeddedFont(''), 'Roboto', 'sans'), 'x')).toMatchObject({ tier: 2, cssFamily: 'Roboto' });
  });

  it.each([
    ['sans', 'Liberation Sans'],
    ['serif', 'Liberation Serif'],
    ['mono', 'Liberation Mono'],
  ] as const)('falls back to Liberation by Font Class for an unknown %s family', (fontClass, expected) => {
    const rf = resolveFontSync(input(embeddedFont(''), 'Obscura Display', fontClass), 'x');
    expect(rf).toMatchObject({ tier: 4, cssFamily: expected });
  });

  it('honours a font the user picked over the original', () => {
    const rf = resolveFontSync(input(embeddedFont('abc'), 'Times', 'serif', 'Lato'), 'abc');
    expect(rf).toMatchObject({ tier: 2, cssFamily: 'Lato' });
  });
});

describe('patchFont', () => {
  it('draws tier 1 in the PDF.js face, mapping text into its private-use characters', () => {
    const font = embeddedFont('The');
    const rf = resolveFontSync(input(font, 'Times', 'serif'), 'The');
    expect(patchFont(rf, font, 'serif', 'eT')).toEqual({ fontFamily: '"g_d0_f3", serif', text: pua(0xe002, 0xe000) });
  });

  it('draws tier 1 of a non-embedded standard font in the installed face PDF.js chose', () => {
    const identity = new Map([...'Thx'].map((ch) => [ch.codePointAt(0) as number, ch.codePointAt(0) as number]));
    const font = embeddedFont('Thx', { face: { family: '"Times",g_d0_sf4,serif', glyphMap: identity } });
    const rf = resolveFontSync(input(font, 'Times', 'serif'), 'Th');
    expect(patchFont(rf, font, 'serif', 'Th')).toEqual({ fontFamily: '"Times",g_d0_sf4,serif', text: 'Th' });
  });

  it('encodes a composite font through its ToUnicode codes, not code points', () => {
    const font = embeddedFont('', {
      encoding: { kind: 'composite', name: 'Identity-H' },
      coverage: new Set('Key'),
      charCodes: new Map([['K', 3], ['e', 7], ['y', 12]]),
      face: { family: '"g_d0_f5", sans-serif', glyphMap: new Map([[3, 0xe003], [7, 0xe007], [12, 0xe00c]]) },
    });
    expect(encodeText('Key', font)).toEqual([3, 7, 12]);
    const rf = resolveFontSync(input(font, 'Liberation Sans', 'sans'), 'yeK');
    expect(rf.tier).toBe(1);
    expect(patchFont(rf, font, 'sans', 'yeK').text).toBe(pua(0xe00c, 0xe007, 0xe003));
  });

  it.each([
    ['sans', 'sans-serif'],
    ['serif', 'serif'],
    ['mono', 'monospace'],
  ] as const)('puts the %s generic family behind a catalog font', (fontClass, generic) => {
    const drawn = patchFont({ tier: 4, source: 'liberation', cssFamily: 'Liberation Sans', reason: '' }, embeddedFont(''), fontClass, 'x');
    expect(drawn).toEqual({ fontFamily: `"Liberation Sans", ${generic}`, text: 'x' });
  });

  it('never draws tier 1 text it cannot map; falls back to Liberation by class', () => {
    const font = embeddedFont('ab');
    const drawn = patchFont({ tier: 1, source: 'original', pdfFontRef: 'f', loadedName: 'f', reason: '' }, font, 'serif', 'az');
    expect(drawn).toEqual({ fontFamily: '"Liberation Serif", serif', text: 'az' });
  });
});

describe('browserFaceOf', () => {
  it('uses the embedded face PDF.js registered, with its private-use characters', () => {
    const toFontChar: (number | undefined)[] = [];
    toFontChar[65] = 0xe010;
    expect(browserFaceOf({ name: 'F', loadedName: 'g_f1', fallbackName: 'serif', toFontChar })).toEqual({
      family: '"g_f1", serif',
      glyphMap: new Map([[65, 0xe010]]),
    });
  });

  it('uses the installed substitute PDF.js chose for a non-embedded font', () => {
    const face = browserFaceOf({
      name: 'Times-Italic',
      loadedName: 'Times',
      missingFile: true,
      toFontChar: [65],
      systemFontInfo: { css: '"Times",g_d0_sf4,serif' },
    });
    expect(face?.family).toBe('"Times",g_d0_sf4,serif');
  });

  it('is absent for Type 3 fonts, unavailable fonts and fonts without char data', () => {
    const toFontChar = [0xe000];
    expect(browserFaceOf({ name: 'F', loadedName: 'g', toFontChar, isType3Font: true })).toBeUndefined();
    expect(browserFaceOf({ name: 'F', loadedName: 'g', toFontChar, missingFile: true })).toBeUndefined();
    expect(browserFaceOf({ name: 'F', toFontChar })).toBeUndefined();
    expect(browserFaceOf({ name: 'F', loadedName: 'g' })).toBeUndefined();
  });
});

describe('charCodesOf', () => {
  it('inverts a ToUnicode map, keeping only drawable codes and the lowest duplicate', () => {
    const map: (string | undefined)[] = [];
    map[3] = 'K';
    map[5] = 'K';
    map[7] = 'e';
    map[9] = 'fi';
    const all = new Map([[3, 1], [5, 1], [7, 1], [9, 1]]);
    expect(charCodesOf({ name: 'F', toUnicode: { _map: map } }, all)).toEqual(new Map([['K', 3], ['e', 7]]));
    expect(charCodesOf({ name: 'F', toUnicode: { _map: map } }, new Map([[7, 1]]))).toEqual(new Map([['e', 7]]));
  });

  it('reads an identity ToUnicode range', () => {
    expect(charCodesOf({ name: 'F', toUnicode: { firstChar: 65, lastChar: 66 } }, undefined)).toEqual(new Map([['A', 65], ['B', 66]]));
  });
});
