import { describe, expect, it } from 'vitest';
import { destroyDocument, loadPdfBytes } from '../../src/lib/pdf-loader';
import { extractImages, type ImageSourcePage } from '../../src/lib/pdf-image-extractor';
import { getSample } from '../../src/lib/sample-documents';
import { INVOICE_LOGO } from '../../src/lib/samples/invoice';
import { NODE_PDFJS_PARAMS, nodeGetDocument } from './pdfjs-node';
import type { PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api';

async function openBytes(bytes: Uint8Array): Promise<PDFDocumentProxy> {
  const result = await loadPdfBytes(nodeGetDocument, { name: 'x.pdf', type: 'application/pdf' }, bytes, NODE_PDFJS_PARAMS);
  if (!result.ok) throw new Error(result.error);
  return result.value.pdf;
}

describe('extractImages', () => {
  it('detects the invoice logo with bbox within 1 pt', async () => {
    const bytes = await getSample('invoice').build();
    const pdf = await openBytes(bytes);
    const page = (await pdf.getPage(1)) as unknown as ImageSourcePage;
    const images = await extractImages(page, 0);

    // Invoice has exactly one embedded PNG logo.
    expect(images.length).toBeGreaterThanOrEqual(1);

    const logo = images[0];
    expect(logo).toBeDefined();
    if (!logo) throw new Error('logo must be defined');
    expect(logo.pageIndex).toBe(0);
    expect(logo.locked).toBe(false);
    expect(logo.id).toMatch(/^img:0:\d+$/);

    // Bbox should match INVOICE_LOGO within 1 pt tolerance.
    const b = logo.bbox;
    expect(b.x).toBeCloseTo(INVOICE_LOGO.x, 0);
    expect(b.width).toBeCloseTo(INVOICE_LOGO.width, 0);
    expect(b.height).toBeCloseTo(INVOICE_LOGO.height, 0);

    await destroyDocument(pdf);
  });

  it('returns no images for a text-only page', async () => {
    const bytes = await getSample('academic-paper').build();
    const pdf = await openBytes(bytes);
    const page = (await pdf.getPage(1)) as unknown as ImageSourcePage;
    const images = await extractImages(page, 0);
    expect(images).toHaveLength(0);
    await destroyDocument(pdf);
  });
});
