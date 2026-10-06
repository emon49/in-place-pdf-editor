import type { PDFDocument } from 'pdf-lib';
import type { PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api';

/**
 * Holds non-serialisable document handles outside the store (design D6):
 * the PDF.js proxy and the untouched original bytes, keyed by document id.
 */
export interface DocumentHandle {
  readonly pdf: PDFDocumentProxy;
  readonly originalBytes: Uint8Array;
}

export type PdfLibLoader = (bytes: Uint8Array) => Promise<PDFDocument>;

export interface DocumentRegistry {
  register(handle: DocumentHandle): string;
  get(id: string): DocumentHandle | undefined;
  /**
   * The document's pdf-lib handle, created on first request over a copy of the original bytes and reused
   * afterwards (design D2). Released with the document.
   */
  getPdfLib(id: string): Promise<PDFDocument>;
  release(id: string): Promise<void>;
}

/** Loaded lazily so pdf-lib stays out of the initial bundle. `updateMetadata: false` keeps the load read-only. */
const loadWithPdfLib: PdfLibLoader = async (bytes) => {
  const { PDFDocument } = await import('pdf-lib');
  return PDFDocument.load(bytes, { updateMetadata: false });
};

export function createDocumentRegistry(
  createId: () => string = () => crypto.randomUUID(),
  loadPdfLib: PdfLibLoader = loadWithPdfLib,
): DocumentRegistry {
  const handles = new Map<string, DocumentHandle>();
  const pdfLibHandles = new Map<string, Promise<PDFDocument>>();
  return {
    register(handle) {
      const id = createId();
      handles.set(id, handle);
      return id;
    },
    get: (id) => handles.get(id),
    getPdfLib(id) {
      const existing = pdfLibHandles.get(id);
      if (existing) return existing;
      const handle = handles.get(id);
      if (!handle) return Promise.reject(new Error('No document open'));
      const created = loadPdfLib(handle.originalBytes.slice());
      pdfLibHandles.set(id, created);
      // A failed load is not cached, so a later request can retry.
      created.catch(() => pdfLibHandles.delete(id));
      return created;
    },
    async release(id) {
      const handle = handles.get(id);
      handles.delete(id);
      pdfLibHandles.delete(id);
      await handle?.pdf.loadingTask.destroy();
    },
  };
}
