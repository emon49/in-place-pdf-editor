import { useStore } from 'zustand';
import { pageGeometryOf } from '../lib/coordinates';
import { createDocumentRegistry } from '../lib/document-registry';
import { createPageModelCache } from '../lib/page-model';
import { createRasterProvider, renderPageRaster } from '../lib/page-raster';
import { openPdf } from '../lib/pdfjs';
import type { SampleId } from '../lib/sample-catalog';
import { createEditorStore, type EditorActions, type EditorState } from './editorStore';

/** The app's single store instance and document registry. */
export const documentRegistry = createDocumentRegistry();
export const pageModelCache = createPageModelCache();

/** Sampling renders, one per page at scale 1, kept apart from the viewer's canvas (design D9). */
export const rasterProvider = createRasterProvider(async (documentId, pageIndex) => {
  const handle = documentRegistry.get(documentId);
  if (!handle) throw new Error('No document open');
  const page = await handle.pdf.getPage(pageIndex + 1);
  return renderPageRaster(page, pageGeometryOf(page));
});

export const editorStore = createEditorStore({
  registry: documentRegistry,
  open: openPdf,
  pageModelCache,
  onDocumentReleased: (id) => rasterProvider.clear(id),
  // Loaded lazily: the extraction and font code stays out of the initial bundle.
  async extractPage(documentId, pageIndex) {
    const handle = documentRegistry.get(documentId);
    if (!handle) throw new Error('No document open');
    const { buildPageModel } = await import('../lib/build-page-model');
    const page = await handle.pdf.getPage(pageIndex + 1);
    return buildPageModel({
      page: page as unknown as Parameters<typeof buildPageModel>[0]['page'],
      pageIndex,
      geometry: pageGeometryOf(page),
      getPdfLib: () => documentRegistry.getPdfLib(documentId),
    });
  },
});

export function useEditor<T>(selector: (state: EditorState & EditorActions) => T): T {
  return useStore(editorStore, selector);
}

/** Generates a sample on the device (lazy-loaded so pdf-lib stays out of the initial bundle) and opens it. */
export async function openSample(id: SampleId): Promise<void> {
  const { getSample } = await import('../lib/sample-documents');
  const sample = getSample(id);
  const bytes = await sample.build();
  await editorStore.getState().openBytes({ name: sample.fileName, type: 'application/pdf' }, bytes);
}
