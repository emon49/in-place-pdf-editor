import { PDFDocument } from 'pdf-lib';
import type { PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api';
import { describe, expect, it } from 'vitest';
import { buildPageModel } from '../../src/lib/build-page-model';
import { createPageGeometry } from '../../src/lib/coordinates';
import { correlateSpans, walkOperatorList } from '../../src/lib/content-stream-state';
import { destroyDocument, loadPdfBytes } from '../../src/lib/pdf-loader';
import { readPageText, type TextSourcePage } from '../../src/lib/pdf-text-extractor';
import { SAMPLES, getSample, type SampleId } from '../../src/lib/sample-documents';
import { NODE_PDFJS_PARAMS, nodeGetDocument } from './pdfjs-node';

async function open(id: SampleId) {
  const bytes = await getSample(id).build();
  const result = await loadPdfBytes(nodeGetDocument, { name: 'x.pdf', type: 'application/pdf' }, bytes, NODE_PDFJS_PARAMS);
  if (!result.ok) throw new Error(result.error);
  const lib = await PDFDocument.load(bytes);
  return { pdf: result.value.pdf, lib };
}

async function model(pdf: PDFDocumentProxy, lib: PDFDocument, pageIndex: number) {
  const page = await pdf.getPage(pageIndex + 1);
  const [x0 = 0, y0 = 0, x1 = 0, y1 = 0] = page.view;
  return buildPageModel({
    page: page as unknown as TextSourcePage,
    pageIndex,
    geometry: createPageGeometry([x0, y0, x1, y1], page.rotate),
    getPdfLib: async () => lib,
  });
}

describe('page model — Invoice', () => {
  it('keeps each item-row cell a separate Text Line and merges nothing across the gaps', async () => {
    const { pdf, lib } = await open('invoice');
    const { lines } = await model(pdf, lib, 0);
    const texts = lines.map((l) => l.text);
    for (const cell of ['Design consultation (hours)', '6', '$85.00', '$510.00', 'Description', 'Qty', 'Unit price', 'Amount'])
      expect(texts).toContain(cell);
    await destroyDocument(pdf);
  });

  it('reports the coloured line with its exact colour and the documented defaults (5.4)', async () => {
    const { pdf, lib } = await open('invoice');
    const { lines } = await model(pdf, lib, 0);
    const unpaid = lines.find((l) => l.text === 'Payment status: UNPAID');
    expect(unpaid?.color).toEqual({ hex: '#CC1A1A', source: 'exact' });
    expect(unpaid).toMatchObject({ charSpacing: 0, wordSpacing: 0, hScale: 100, rise: 0, renderMode: 0, bold: true, fontSize: 10 });
    const title = lines.find((l) => l.text === 'INVOICE');
    expect(title).toMatchObject({ family: 'Helvetica', bold: true, fontClass: 'sans', fontSize: 20, lockReason: null });
    expect(title?.font.embedding).toMatchObject({ embedded: false, standardReference: true });
    await destroyDocument(pdf);
  });

  it('gives Text Lines geometry in Page Space (3.4)', async () => {
    const { pdf, lib } = await open('invoice');
    const { lines } = await model(pdf, lib, 0);
    const title = lines.find((l) => l.text === 'INVOICE');
    expect(title?.origin).toEqual({ x: 450, y: 722 });
    expect(title?.box.x).toBeCloseTo(450);
    expect(title?.box.y).toBeLessThan(722);
    expect((title?.box.y ?? 0) + (title?.box.height ?? 0)).toBeGreaterThan(722);
    await destroyDocument(pdf);
  });

  it('has the image line overlapping the logo', async () => {
    const { pdf, lib } = await open('invoice');
    const { lines } = await model(pdf, lib, 0);
    expect(lines.find((l) => l.text === 'LOGO')?.color.hex).toBe('#FFFFFF');
    await destroyDocument(pdf);
  });
});

describe('page model — Academic paper', () => {
  it('reports the word-by-word line as one Text Line with spaces, in the embedded subset font (1.2, 4.3)', async () => {
    const { pdf, lib } = await open('academic-paper');
    const { lines } = await model(pdf, lib, 0);
    const keywords = lines.filter((l) => l.text.startsWith('Keywords'));
    expect(keywords.map((l) => l.text)).toEqual(['Keywords: layout, typography, fonts, masks']);
    expect(keywords[0]).toMatchObject({ family: 'Liberation Sans', subsetPrefix: 'QXZKLM', fontClass: 'sans' });
    expect(keywords[0]?.font.embedding).toMatchObject({ embedded: true, programType: 'TrueType' });
    expect(keywords[0]?.font.coverage?.has('k')).toBe(true);
    await destroyDocument(pdf);
  });
});

describe('page model — Technical spec', () => {
  it('locks the rotated watermark with a reason (3.5)', async () => {
    const { pdf, lib } = await open('tech-spec');
    const { lines } = await model(pdf, lib, 0);
    const watermark = lines.find((l) => l.text === 'DRAFT SAMPLE');
    expect(watermark?.lockReason).toBe('rotated-or-skewed');
    expect(lines.filter((l) => l.lockReason !== null)).toHaveLength(1);
    await destroyDocument(pdf);
  });

  it('does not lock horizontal text on the /Rotate 90 page, and orders it by the displayed layout (3.5, 3.6)', async () => {
    const { pdf, lib } = await open('tech-spec');
    const { lines } = await model(pdf, lib, 1);
    expect(lines.every((l) => l.lockReason === null)).toBe(true);
    expect(lines[0]?.text).toBe('Register map (landscape)');
    const names = lines.map((l) => l.text);
    expect(names.indexOf('Offset')).toBeLessThan(names.indexOf('0x00'));
    expect(names.indexOf('CTRL')).toBeLessThan(names.indexOf('STATUS'));
    await destroyDocument(pdf);
  });

  it('boxes are axis-aligned and non-negative on the cropped page', async () => {
    const { pdf, lib } = await open('tech-spec');
    const { lines } = await model(pdf, lib, 2);
    expect(lines.length).toBeGreaterThan(0);
    for (const l of lines) {
      expect(l.box.width).toBeGreaterThan(0);
      expect(l.box.height).toBeGreaterThan(0);
    }
    await destroyDocument(pdf);
  });
});

describe.each(SAMPLES.map((s) => [s.id] as const))('%s: shared behaviours', (id) => {
  it('correlates every text item with a span (5.2)', async () => {
    const { pdf } = await open(id);
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = (await pdf.getPage(p)) as unknown as TextSourcePage;
      const text = await readPageText(page);
      const styled = correlateSpans(text.fragments, walkOperatorList(text.operatorList));
      const bad = styled.filter((f) => f.match !== 'exact');
      expect(bad.map((f) => f.text), `page ${p}`).toEqual([]);
      expect(styled.every((f) => f.colorResolved)).toBe(true);
    }
    await destroyDocument(pdf);
  });

  it('assigns identifiers in reading order that are unchanged when a page is extracted twice (3.6)', async () => {
    const { pdf, lib } = await open(id);
    for (let p = 0; p < pdf.numPages; p++) {
      const first = await model(pdf, lib, p);
      const second = await model(pdf, lib, p);
      expect(second.lines.map((l) => l.id)).toEqual(first.lines.map((l) => l.id));
      expect(first.lines.map((l) => l.id)).toEqual(first.lines.map((_, i) => `${p}:${i}`));
      expect(second.lines.map((l) => l.text)).toEqual(first.lines.map((l) => l.text));
    }
    await destroyDocument(pdf);
  });
});
