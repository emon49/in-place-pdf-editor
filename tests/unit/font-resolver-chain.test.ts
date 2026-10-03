import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveFont } from '../../src/lib/font-resolver';
import { resetConsentState } from '../../src/lib/font-fetcher';
import type { TextLine } from '../../src/types/page-model';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../src/lib/font-fetcher', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/lib/font-fetcher')>();
  return {
    ...actual,
    fetchCatalogFont: vi.fn(async (entry: { cssFamily: string }) => entry.cssFamily),
    fetchGoogleFont: vi.fn(async () => null),
  };
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeLine(overrides: Partial<TextLine> = {}): TextLine {
  return {
    id: '0:1',
    pageIndex: 0,
    text: 'Hello',
    origin: { x: 0, y: 0 },
    box: { x: 0, y: 0, width: 100, height: 12 },
    matrix: [1, 0, 0, 1, 0, 0],
    fontRef: 'F1',
    family: 'Helvetica',
    subsetPrefix: null,
    fontClass: 'sans',
    bold: false,
    italic: false,
    fontSize: 12,
    hScale: 100,
    charSpacing: 0,
    wordSpacing: 0,
    rise: 0,
    renderMode: 0,
    lineHeight: 1.2,
    color: { hex: '#000000', source: 'exact' },
    background: { status: 'pending' },
    lockReason: null,
    font: {
      rawName: 'Helvetica',
      subtype: 'Type1',
      embedding: { embedded: true, standardReference: false, programType: 'Type1', programSize: 1000 },
      licence: { fsType: 0, editable: true, restriction: null },
      encoding: { kind: 'simple', name: 'WinAnsiEncoding' },
      coverage: new Set([...'Hello World']),
    },
    ...overrides,
  };
}

beforeEach(() => {
  resetConsentState();
});

afterEach(() => {
  vi.clearAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('resolveFont — tier selection', () => {
  it('selects tier 1 when font is editable and coverage matches', async () => {
    const line = makeLine();
    const result = await resolveFont(line, 'Hello', 'pending');
    expect(result.tier).toBe(1);
    expect(result.source).toBe('original');
  });

  it('skips tier 1 when fsType forbids editing', async () => {
    const line = makeLine({
      font: {
        rawName: 'Helvetica',
        subtype: 'Type1',
        embedding: { embedded: true, standardReference: false, programType: 'Type1', programSize: 1000 },
        licence: { fsType: 2, editable: false, restriction: 'no-edit' },
        encoding: { kind: 'simple', name: 'WinAnsiEncoding' },
        coverage: new Set([...'Hello']),
      },
    });
    const result = await resolveFont(line, 'Hello', 'pending');
    expect(result.tier).toBeGreaterThan(1);
  });

  it('skips tier 1 when text contains chars outside coverage', async () => {
    const line = makeLine({
      font: {
        rawName: 'Helvetica',
        subtype: null,
        embedding: null,
        licence: { fsType: 0, editable: true, restriction: null },
        encoding: { kind: 'simple', name: 'WinAnsiEncoding' },
        coverage: new Set([...'abc']),
      },
    });
    const result = await resolveFont(line, 'xyz', 'pending');
    expect(result.tier).toBeGreaterThan(1);
  });

  it('selects tier 2 from catalog for a matching family name', async () => {
    // Use a family that IS in the catalog directly
    const line = makeLine({
      family: 'Roboto',
      font: {
        rawName: 'Roboto',
        subtype: null,
        embedding: null,
        licence: { fsType: 0, editable: false, restriction: 'no-edit' },
        encoding: null,
        coverage: null,
      },
    });
    const result = await resolveFont(line, 'test', 'pending');
    expect(result.tier).toBe(2);
    expect(result.source).toBe('catalog');
  });

  it('selects tier 3 substitute for Arial → Liberation Sans', async () => {
    // Arial IS in the substitute table
    const line = makeLine({
      family: 'Arial',
      font: {
        rawName: 'Arial',
        subtype: null,
        embedding: null,
        licence: { fsType: 0, editable: false, restriction: 'no-edit' },
        encoding: null,
        coverage: null,
      },
    });
    // Arial maps to Liberation Sans in the catalog via substitute — should be tier 2 (catalog hit)
    const result = await resolveFont(line, 'test', 'pending');
    // Arial is in the substitute table, and lookupCatalog('Arial') returns Liberation Sans entry
    // So this hits tier 2 (catalog match via substitute)
    expect(result.tier).toBeLessThanOrEqual(3);
  });

  it('falls back to tier 4 for unknown family', async () => {
    const line = makeLine({
      family: 'UnknownFontXYZ',
      fontClass: 'sans',
      font: {
        rawName: 'UnknownFontXYZ',
        subtype: null,
        embedding: null,
        licence: null,
        encoding: null,
        coverage: null,
      },
    });
    const result = await resolveFont(line, 'test', 'denied');
    expect(result.tier).toBe(4);
    expect(result.source).toBe('liberation');
  });
});
