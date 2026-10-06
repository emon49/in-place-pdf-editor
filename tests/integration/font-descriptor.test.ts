import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import {
  findFontDictionary,
  fontFactsFromDictionary,
  readFontDictionary,
  unknownFontFacts,
} from '../../src/lib/font-descriptor';
import { identifyFont } from '../../src/lib/font-resolver';
import { getSample, type SampleId } from '../../src/lib/sample-documents';
import { FRAGMENTED_LINE_WORDS, SUBSET_FONT_NAME } from '../../src/lib/samples/academic-paper';

async function load(id: SampleId) {
  return PDFDocument.load(await getSample(id).build());
}

async function factsFor(id: SampleId, baseFont: string, pageIndex = 0) {
  const doc = await load(id);
  const dict = findFontDictionary(doc, pageIndex, baseFont);
  if (!dict) throw new Error(`No font dictionary for ${baseFont}`);
  const parsed = readFontDictionary(dict);
  return { parsed, facts: fontFactsFromDictionary(parsed) };
}

describe('font dictionary reader (4.3)', () => {
  it('reports the subset sample font as embedded TrueType with composite encoding', async () => {
    const { parsed, facts } = await factsFor('academic-paper', SUBSET_FONT_NAME);
    expect(facts.embedding).toMatchObject({ embedded: true, standardReference: false, programType: 'TrueType' });
    expect(facts.embedding?.programSize).toBeGreaterThan(1000);
    expect(parsed.subtype).toBe('Type0');
    expect(facts.encoding).toEqual({ kind: 'composite', name: 'Identity-H' });
  });

  it('reports a Standard 14 font as not embedded, a standard reference, with a simple encoding', async () => {
    const { facts } = await factsFor('invoice', 'Helvetica-Bold');
    expect(facts.embedding).toEqual({ embedded: false, standardReference: true, programType: null, programSize: 0 });
    expect(facts.encoding).toEqual({ kind: 'simple', name: 'WinAnsiEncoding' });
    expect(facts.licence).toEqual({ fsType: null, editable: true, restriction: null });
  });

  it('reads descriptor hints of the embedded font', async () => {
    const { parsed } = await factsFor('academic-paper', SUBSET_FONT_NAME);
    expect(parsed.hints?.flags).not.toBeNull();
    expect(identifyFont(parsed.baseFont, parsed.hints)).toMatchObject({
      family: 'Liberation Sans',
      subsetPrefix: 'QXZKLM',
      fontClass: 'sans',
    });
  });

  it('finds fonts on every page and returns undefined for a missing font', async () => {
    const doc = await load('tech-spec');
    expect(findFontDictionary(doc, 0, 'Helvetica-Bold')).toBeDefined();
    expect(findFontDictionary(doc, 0, 'NoSuchFont')).toBeUndefined();
  });

  it('has no OS/2 table in the subset, so editing is permitted and the licence is not restricted', async () => {
    const { facts } = await factsFor('academic-paper', SUBSET_FONT_NAME);
    expect(facts.licence).toEqual({ fsType: null, editable: true, restriction: null });
  });
});

describe('character coverage (4.5)', () => {
  it('holds exactly the characters the subset draws', async () => {
    const { facts } = await factsFor('academic-paper', SUBSET_FONT_NAME);
    const drawn = new Set(FRAGMENTED_LINE_WORDS.join(''));
    expect(facts.coverage).not.toBeNull();
    for (const c of drawn) expect(facts.coverage?.has(c), c).toBe(true);
    expect(facts.coverage?.has('Q')).toBe(false);
    expect(facts.coverage?.has('z')).toBe(false);
    expect(facts.coverage?.size).toBe(drawn.size);
  });

  it('uses the named standard encoding for a non-embedded font', async () => {
    const { facts } = await factsFor('invoice', 'Helvetica');
    expect(facts.coverage?.has('A')).toBe(true);
    expect(facts.coverage?.has('€')).toBe(true);
    expect(facts.coverage?.has('Ж')).toBe(false);
  });
});

describe('unreadable facts degrade safely (4.6)', () => {
  it('keeps family and style while marking coverage and licence unknown for a truncated program', async () => {
    const { parsed } = await factsFor('academic-paper', SUBSET_FONT_NAME);
    if (!parsed.program?.bytes) throw new Error('subset program missing');
    const damaged = { ...parsed, program: { ...parsed.program, bytes: parsed.program.bytes.subarray(0, 30) }, toUnicode: null };
    const facts = fontFactsFromDictionary(damaged);
    expect(facts.coverage).toBeNull();
    expect(facts.licence).toBeNull();
    expect(facts.embedding?.embedded).toBe(true);
    expect(identifyFont(facts.rawName, parsed.hints)).toMatchObject({ family: 'Liberation Sans', fontClass: 'sans' });
  });

  it('marks an undecodable program unknown', async () => {
    const { parsed } = await factsFor('academic-paper', SUBSET_FONT_NAME);
    const facts = fontFactsFromDictionary({ ...parsed, program: parsed.program && { ...parsed.program, bytes: null } });
    expect(facts.coverage).toBeNull();
    expect(facts.licence).toBeNull();
  });

  it('reports everything beyond the name as unknown for an unmatched font', () => {
    expect(unknownFontFacts('Mystery')).toEqual({
      rawName: 'Mystery',
      subtype: null,
      embedding: null,
      licence: null,
      encoding: null,
      coverage: null,
    });
  });
});
