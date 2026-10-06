import type { PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api';

// Thumbnails render one at a time so they never compete with the main page render.
let queue: Promise<unknown> = Promise.resolve();

/**
 * Renders page `pageIndex` of the open document to a PNG `width` CSS pixels wide (page-thumbnails
 * spec). Uses the document PDF.js already has open, so no bytes are copied or sent anywhere.
 */
export function renderThumbnail(pdf: PDFDocumentProxy, pageIndex: number, width: number): Promise<Blob | null> {
  const job = queue.then(async () => {
    const page = await pdf.getPage(pageIndex + 1);
    const natural = page.getViewport({ scale: 1 });
    const scale = (width * (globalThis.devicePixelRatio || 1)) / natural.width;
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvas, viewport }).promise;
    return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve));
  });
  queue = job.catch(() => undefined);
  return job;
}
