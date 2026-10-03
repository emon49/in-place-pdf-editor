import type { PageGeometry } from './coordinates';
import { displaySize } from './coordinates';
import type { Raster } from './pdf-color-extractor';

/** The part of a PDF.js page the sampling render needs (matches `RenderablePage` in the viewer). */
export interface RasterPage {
  getViewport(params: { scale: number }): { width: number; height: number };
  render(params: { canvas: HTMLCanvasElement; viewport: never }): { promise: Promise<void> };
}

/**
 * Renders a page once at scale 1 into an off-screen canvas and returns its pixels (design D9). Scale 1 means one
 * pixel per Display point whatever the viewer's zoom is, so results never depend on zoom and the viewer's own
 * render path is untouched.
 */
export async function renderPageRaster(page: RasterPage, geometry: PageGeometry): Promise<Raster> {
  const size = displaySize(geometry);
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(size.width);
  canvas.height = Math.ceil(size.height);
  const viewport = page.getViewport({ scale: 1 });
  await page.render({ canvas, viewport: viewport as never }).promise;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Canvas 2D context unavailable');
  const { width, height, data } = context.getImageData(0, 0, canvas.width, canvas.height);
  return { width, height, data };
}

export interface RasterProvider {
  /** The page's sampling raster; rendered on first request and shared by later ones. */
  get(documentId: string, pageIndex: number): Promise<Raster>;
  clear(documentId: string): void;
}

export function createRasterProvider(render: (documentId: string, pageIndex: number) => Promise<Raster>): RasterProvider {
  const rasters = new Map<string, Promise<Raster>>();
  return {
    get(documentId, pageIndex) {
      const key = `${documentId}:${pageIndex}`;
      const existing = rasters.get(key);
      if (existing) return existing;
      const created = render(documentId, pageIndex);
      rasters.set(key, created);
      // A failed render is not cached, so a later request can retry.
      created.catch(() => rasters.delete(key));
      return created;
    },
    clear(documentId) {
      for (const key of [...rasters.keys()]) if (key.startsWith(`${documentId}:`)) rasters.delete(key);
    },
  };
}
