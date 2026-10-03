import type { PageModel } from '../types/page-model';

/**
 * Per-document cache of extracted page models (design D11). Models hold large arrays and byte buffers, so they
 * live here, beside the document registry, rather than in the store.
 */
export interface PageModelCache {
  get(documentId: string, pageIndex: number): PageModel | undefined;
  set(documentId: string, pageIndex: number, model: PageModel): void;
  /** Drops every model of a document (the document was replaced). */
  clear(documentId: string): void;
}

export const pageModelKey = (documentId: string, pageIndex: number): string => `${documentId}:${pageIndex}`;

export function createPageModelCache(): PageModelCache {
  const models = new Map<string, PageModel>();
  return {
    get: (documentId, pageIndex) => models.get(pageModelKey(documentId, pageIndex)),
    set: (documentId, pageIndex, model) => void models.set(pageModelKey(documentId, pageIndex), model),
    clear(documentId) {
      const prefix = `${documentId}:`;
      for (const key of [...models.keys()]) if (key.startsWith(prefix)) models.delete(key);
    },
  };
}
