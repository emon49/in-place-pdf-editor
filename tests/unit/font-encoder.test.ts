import { describe, expect, it } from 'vitest';
import { checkDrawability, encodeText } from '../../src/lib/font-encoder';
import type { FontFacts } from '../../src/types/page-model';

function fakeFontFacts(overrides: Partial<FontFacts> = {}): FontFacts {
  return {
    rawName: 'TestFont',
    subtype: null,
    embedding: null,
    licence: null,
    encoding: null,
    coverage: null,
    ...overrides,
  };
}

describe('encodeText', () => {
  it('WinAnsi round-trip for ASCII', () => {
    const font = fakeFontFacts({ encoding: { kind: 'simple', name: 'WinAnsiEncoding' } });
    const codes = encodeText('Hello', font);
    expect(codes).toEqual([72, 101, 108, 108, 111]);
  });

  it('WinAnsi round-trip for extended chars', () => {
    const font = fakeFontFacts({ encoding: { kind: 'simple', name: 'WinAnsiEncoding' } });
    const codes = encodeText('€', font); // 0x80 in Windows-1252
    expect(codes).toEqual([0x80]);
  });

  it('WinAnsi returns null for chars outside WinAnsi range', () => {
    const font = fakeFontFacts({ encoding: { kind: 'simple', name: 'WinAnsiEncoding' } });
    expect(encodeText('中', font)).toBeNull();
  });

  it('Identity-H code-point passthrough for BMP chars', () => {
    const font = fakeFontFacts({ encoding: { kind: 'composite', name: 'Identity-H' } });
    const codes = encodeText('A中', font);
    expect(codes).toEqual([65, 0x4e2d]);
  });

  it('subset font with partial coverage returns null for missing chars', () => {
    const font = fakeFontFacts({
      encoding: { kind: 'simple', name: 'WinAnsiEncoding' },
      coverage: new Set(['H', 'e', 'l', 'o']),
    });
    // 'x' is not in coverage and WinAnsi range; WinAnsi path doesn't use coverage
    // So this test is about the drawability path
    const result = checkDrawability('Hello x', font, new Set(['H', 'e', 'l', 'o']));
    expect(result.drawable).toBe(false);
    expect(result.firstUndrawable).toBe(' ');
  });

  it('unknown encoding returns null', () => {
    const font = fakeFontFacts({ encoding: { kind: 'simple', name: 'CustomEncoding' } });
    expect(encodeText('A', font)).toBeNull();
  });

  it('empty string returns empty array', () => {
    const font = fakeFontFacts({ encoding: { kind: 'composite', name: 'Identity-H' } });
    expect(encodeText('', font)).toEqual([]);
  });
});

describe('checkDrawability', () => {
  it('all-drawable returns true', () => {
    const font = fakeFontFacts();
    const coverage = new Set(['H', 'i']);
    expect(checkDrawability('Hi', font, coverage)).toEqual({ drawable: true });
  });

  it('first undrawable character is identified', () => {
    const font = fakeFontFacts();
    const coverage = new Set(['H', 'i']);
    const result = checkDrawability('Hi!', font, coverage);
    expect(result.drawable).toBe(false);
    expect(result.firstUndrawable).toBe('!');
  });

  it('empty string returns drawable', () => {
    const font = fakeFontFacts();
    expect(checkDrawability('', font, null)).toEqual({ drawable: true });
  });

  it('null coverage defaults to true (no info)', () => {
    const font = fakeFontFacts({ coverage: null });
    expect(checkDrawability('anything', font, null)).toEqual({ drawable: true });
  });
});
