import type { PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api';

/**
 * Holds non-serialisable document handles outside the store (design D6):
 * the PDF.js proxy and the untouched original bytes, keyed by document id.
 */
export interface DocumentHandle {
  readonly pdf: PDFDocumentProxy;
  readonly originalBytes: Uint8Array;
}

export interface DocumentRegistry {
  register(handle: DocumentHandle): string;
  get(id: string): DocumentHandle | undefined;
  release(id: string): Promise<void>;
}

export function createDocumentRegistry(createId: () => string = () => crypto.randomUUID()): DocumentRegistry {
  const handles = new Map<string, DocumentHandle>();
  return {
    register(handle) {
      const id = createId();
      handles.set(id, handle);
      return id;
    },
    get: (id) => handles.get(id),
    async release(id) {
      const handle = handles.get(id);
      handles.delete(id);
      await handle?.pdf.loadingTask.destroy();
    },
  };
}
