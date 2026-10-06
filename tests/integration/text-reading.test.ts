import fontkit from '@pdf-lib/fontkit';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { PDFDocument } from 'pdf-lib';
import type { PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api';
import { describe, expect, it } from 'vitest';
import { destroyDocument, loadPdfBytes } from '../../src/lib/pdf-loader';
import { readPageText, type TextSourcePage } from '../../src/lib/pdf-text-extractor';
import { getSample, type SampleId } from '../../src/lib/sample-documents';
import { NODE_PDFJS_PARAMS, nodeGetDocument } from './pdfjs-node';

async function openBytes(bytes: Uint8Array): Promise<PDFDocumentProxy> {
  const result = await loadPdfBytes(nodeGetDocument, { name: 'x.pdf', type: 'application/pdf' }, bytes, NODE_PDFJS_PARAMS);
  if (!result.ok) throw new Error(result.error);
  return result.value.pdf;
}

const page = async (id: SampleId, n = 1) => {
  const pdf = await openBytes(await getSample(id).build());
  return { pdf, page: (await pdf.getPage(n)) as unknown as TextSourcePage };
};

describe('readPageText (3.1)', () => {
  it('reads Invoice fragments with their matrices and font facts', async () => {
    const { pdf, page: p } = await page('invoice');
    const { fragments, fonts } = await readPageText(p);
    const invoice = fragments.find((f) => f.text === 'INVOICE');
    expect(invoice?.matrix).toEqual([20, 0, 0, 20, 450, 722]);
    expect(invoice?.type3).toBe(false);
    expect(invoice?.ascent).toBeGreaterThan(0);
    expect(invoice?.descent).toBeLessThan(0);
    expect(fonts.get(invoice?.fontName ?? '')?.name).toBe('Helvetica-Bold');
    // Each item-row cell is its own fragment.
    expect(fragments.some((f) => f.text === 'Design consultation (hours)')).toBe(true);
    expect(fragments.some((f) => f.text === '$510.00')).toBe(true);
    await destroyDocument(pdf);
  });

  it('skips empty line-end markers', async () => {
    const { pdf, page: p } = await page('invoice');
    const { fragments } = await readPageText(p);
    expect(fragments.every((f) => f.text !== '' || f.width > 0)).toBe(true);
    await destroyDocument(pdf);
  });

  it('keeps a ligature unnormalised', async () => {
    const font = readFileSync(
      createRequire(import.meta.url).resolve('pdfjs-dist/standard_fonts/LiberationSans-Regular.ttf'),
    );
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);
    const embedded = await doc.embedFont(font, { subset: true });
    doc.addPage([200, 100]).drawText('ﬁle', { x: 10, y: 50, size: 12, font: embedded });
    const pdf = await openBytes(await doc.save({ useObjectStreams: false }));
    const { fragments } = await readPageText((await pdf.getPage(1)) as unknown as TextSourcePage);
    expect(fragments.map((f) => f.text).join('')).toBe('ﬁle');
    await destroyDocument(pdf);
  });
});
