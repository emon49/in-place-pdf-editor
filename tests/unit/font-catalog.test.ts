import { describe, expect, it } from 'vitest';
import { lookupCatalog, lookupSubstitute, normalizeFamily } from '../../src/lib/font-catalog';

describe('font-catalog lookupCatalog', () => {
  it('returns the catalog entry for a directly registered family', () => {
    const entry = lookupCatalog('Roboto');
    expect(entry).not.toBeNull();
    expect(entry!.family).toBe('Roboto');
  });

  it('is case-insensitive', () => {
    expect(lookupCatalog('ROBOTO')).not.toBeNull();
    expect(lookupCatalog('liberation sans')).not.toBeNull();
  });

  it('returns substitute entry for Arial → Liberation Sans', () => {
    const entry = lookupCatalog('Arial');
    expect(entry).not.toBeNull();
    expect(entry!.family).toBe('Liberation Sans');
  });

  it('returns substitute for Helvetica → Liberation Sans', () => {
    expect(lookupCatalog('Helvetica')?.family).toBe('Liberation Sans');
  });

  it('returns substitute for Calibri → Carlito', () => {
    expect(lookupCatalog('Calibri')?.family).toBe('Carlito');
  });

  it('returns substitute for Cambria → Caladea', () => {
    expect(lookupCatalog('Cambria')?.family).toBe('Caladea');
  });

  it('returns substitute for Georgia → Gelasio', () => {
    expect(lookupCatalog('Georgia')?.family).toBe('Gelasio');
  });

  it('returns null for unknown family', () => {
    expect(lookupCatalog('SomeMadeUpFont')).toBeNull();
  });
});

describe('normalizeFamily', () => {
  it('lowercases and trims whitespace', () => {
    expect(normalizeFamily('  Times New Roman  ')).toBe('times new roman');
    expect(normalizeFamily('OpenSans')).toBe('opensans');
  });
});

describe('lookupSubstitute', () => {
  it('returns Liberation Sans for Arial', () => {
    expect(lookupSubstitute('arial')).toBe('Liberation Sans');
  });

  it('returns null for unknown family', () => {
    expect(lookupSubstitute('Fictional Font')).toBeNull();
  });
});
