import { useEffect } from 'react';
import { pageGeometryOf } from '../lib/coordinates';
import { scheduleSampling } from '../lib/page-sampler';
import { pageModelKey } from '../lib/page-model';
import type { PageModel, PageModelStatus } from '../types/page-model';
import { documentRegistry, editorStore, pageModelCache, rasterProvider, useEditor } from './useEditor';

export interface PageModelView {
  readonly status: PageModelStatus;
  readonly model: PageModel | undefined;
}

/**
 * The read model of a page. Re-renders when the page's status or revision changes (e.g. background sampling
 * finished), so consumers see updated lines without the page being rendered again.
 */
export function usePageModel(documentId: string | undefined, pageIndex: number): PageModelView {
  const entry = useEditor((s) => (documentId ? s.pageModels[pageModelKey(documentId, pageIndex)] : undefined));
  const status = entry?.status ?? 'idle';
  const model = documentId && status === 'ready' ? pageModelCache.get(documentId, pageIndex) : undefined;
  return { status, model };
}

/**
 * Samples backgrounds (and unresolved text colours) of the active page once it is both extracted and rendered,
 * in an idle callback, and refreshes the model in place (VW-9, design D9).
 */
export function usePageSampling(documentId: string | undefined, pageIndex: number, renderedPageIndex: number | null): void {
  const { status, model } = usePageModel(documentId, pageIndex);
  const needsSampling = status === 'ready' && !!model && model.lines.some((l) => l.background.status === 'pending');

  useEffect(() => {
    if (!documentId || !needsSampling || renderedPageIndex !== pageIndex) return;
    const handle = documentRegistry.get(documentId);
    if (!handle) return;
    let cancelSampling: (() => void) | undefined;
    let active = true;
    void handle.pdf.getPage(pageIndex + 1).then((page) => {
      if (!active) return;
      cancelSampling = scheduleSampling({
        documentId,
        pageIndex,
        geometry: pageGeometryOf(page),
        cache: pageModelCache,
        getRaster: () => rasterProvider.get(documentId, pageIndex),
        onUpdated: () => editorStore.getState().touchPageModel(pageIndex),
      });
    });
    return () => {
      active = false;
      cancelSampling?.();
    };
  }, [documentId, pageIndex, renderedPageIndex, needsSampling]);
}
